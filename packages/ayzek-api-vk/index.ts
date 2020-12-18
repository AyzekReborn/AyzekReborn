import StringReader from '@ayzek/command-parser/reader';
import { Api, ApiPlugin } from '@ayzek/core/api';
import { Conversation } from '@ayzek/core/conversation';
import ApiFeature from '@ayzek/core/features';
import { IMessageOptions } from '@ayzek/core/message';
import { Attachment, File, Image, Location } from '@ayzek/core/model/attachment';
import { opaqueToAyzek } from '@ayzek/core/text';
import arrayChunks from '@ayzek/core/util/arrayChunks';
import { splitByMaxPossibleParts } from '@ayzek/core/util/split';
import { CodeTextPart, FormattingTextPart, HashTagTextPart, OpaqueTextPart, Text, TextPart, Translation } from '@ayzek/text';
import { Component } from '@ayzek/text/component';
import { LANGUAGES } from '@ayzek/text/language';
import { LOCALES } from '@ayzek/text/locale';
import { Preformatted } from '@ayzek/text/translation';
import type { MaybePromise } from '@meteor-it/utils';
import { emit } from '@meteor-it/xrest';
import * as multipart from '@meteor-it/xrest/multipart';
import * as t from 'io-ts';
import { pick } from 'lodash';
import VKApiProcessor from './apiProcessor';
import { VKUserArgumentType } from './arguments';
import { VKChat, VKChatMap } from './chat';
import VKGroupUpdateHandler from './groupUpdateHandler';
import type { IVKKeyboard } from './keyboard';
import { VKBot, VKBotMap } from './user/bot';
import { VKRealUser, VKUserMap } from './user/realUser';
import VKUser from './user/user';
import VKUserUpdateHandler from './userUpdateHandler';

const MAX_MESSAGE_LENGTH = 4096;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
type ExtraAttachment = Location;
const EXTRA_ATTACHMENT_PREDICATE = (a: Attachment) => a instanceof Location;

export type IVKMessageOptions = IMessageOptions & {
	vkKeyboard?: IVKKeyboard,
};

const VKApiConfiguration = t.interface({
	descriminator: t.string,
	isUserAccount: t.boolean,
	accountId: t.number,
	tokens: t.array(t.string),
});

export class VKApi extends Api {
	processor: VKApiProcessor;
	userMap: VKUserMap;
	botMap: VKBotMap;
	chatMap: VKChatMap;
	updateHandler: VKUserUpdateHandler | VKGroupUpdateHandler;
	// TODO: Work as user account (illegal :D)
	constructor(public config: t.TypeOf<typeof VKApiConfiguration>) {
		super('vk');
		this.processor = new VKApiProcessor(this.logger, config.tokens, config.isUserAccount);
		this.userMap = new VKUserMap(this);
		this.botMap = new VKBotMap(this);
		this.chatMap = new VKChatMap(this);
		this.updateHandler = config.isUserAccount ? (new VKUserUpdateHandler(this)) : (new VKGroupUpdateHandler(this));
	}
	async init() {
	}
	get isUser() {
		return this.config.isUserAccount;
	}
	getApiUser(id: number): MaybePromise<VKUser | null> {
		if (id < 0) {
			return this.botMap.get(-id);
		}
		return this.userMap.get(id);
	}
	getApiChat(id: number): MaybePromise<VKChat | null> {
		if (id >= 2e9) throw new Error('Already transformed id passed');
		return this.chatMap.get(id);
	}
	encodeUserUid(id: number): string {
		return `VKU:${this.config.descriminator}:${id}`;
	}
	encodeChatCid(id: number): string {
		return `VKC:${this.config.descriminator}:${id}`;
	}
	getUser(uid: string): MaybePromise<VKUser | null> {
		const userPrefix = `VKU:${this.config.descriminator}:`;
		if (!uid.startsWith(userPrefix)) {
			return null;
		}
		const id = parseInt(uid.replace(userPrefix, ''), 10);
		if (isNaN(id))
			return null;
		return this.getApiUser(id);
	}
	getChat(cid: string) {
		const chatPrefix = `VKC:${this.config.descriminator}:`;
		if (!cid.startsWith(chatPrefix)) {
			return Promise.resolve(null);
		}
		const id = parseInt(cid.replace(chatPrefix, ''), 10);
		if (isNaN(id))
			return Promise.resolve(null);
		return this.getApiChat(id);
	}
	execute(method: string, params: any) {
		return this.processor.runTask({
			method, params,
		});
	}

	async loop() {
		await this.init();
		// eslint-disable-next-line no-constant-condition
		while (true) {
			try {
				const data = await this.execute(this.isUser ? 'messages.getLongPollServer' : 'groups.getLongPollServer', {
					group_id: this.isUser ? undefined : this.config.accountId,
					lp_version: this.isUser ? 3 : undefined,
				});
				if (!data || !data.server) {
					this.logger.error('Can\'t get data!');
					this.logger.error(data);
					continue;
				}
				const { key } = data;
				let { ts, server } = data;
				if (!server.startsWith('https://')) {
					server = `https://${server}`;
				}
				// eslint-disable-next-line no-constant-condition
				eventLoop: while (true) {
					const events = (await emit('GET', server, {
						query: {
							act: 'a_check',
							key,
							ts,
							wait: 25,
							mode: 66,
						},
						timeout: 0,
					})).jsonBody!;

					if (events.failed) {
						switch (events.failed) {
							case 1:
								ts = events.ts;
								continue eventLoop;
							case 2:
							case 3:
								break eventLoop;
							case 4:
							default:
								this.logger.error(`receive error: ${events}`);
								break eventLoop;
						}
					}
					ts = events.ts;

					events.updates.forEach(async (update: any) => {
						try {
							await this.updateHandler.processUpdate(update);
						} catch (e) {
							this.logger.error('Update processing error: ', update);
							this.logger.error(e.stack);
						}
					});
				}
				this.logger.warn('Loop end (???), waiting 5s before restart');
				await new Promise(res => setTimeout(res, 5000));
				this.logger.warn('Loop restart');
			} catch (e) {
				this.logger.error('Hard error');
				this.logger.error(e.stack);
			}
		}
	}

	async uploadAttachment(attachment: Attachment, peerId: string): Promise<string> {
		if (attachment instanceof Image) {
			return await this.genericUpload('photos.getMessagesUploadServer', 'photos.saveMessagesPhoto', attachment, peerId, 'photo', ['server', 'hash'], photo => `photo${photo[0].owner_id}_${photo[0].id}`);
		} else if (attachment instanceof File) {
			return await this.genericUpload('docs.getMessagesUploadServer', 'docs.save', attachment, peerId, 'file', [], doc => `doc${doc.doc.owner_id}_${doc.doc.id}`);
		}
		throw new Error('Not implemented');
	}

	async genericUpload(getServerMethod: string, saveMethod: string, attachment: Image | File, peerId: string, field: string, additionalField: string[], toId: (uploaded: any) => string): Promise<string> {
		// TODO: Upload server pool/cache
		const server = await this.execute(getServerMethod, { peer_id: peerId });
		const stream = attachment.data.toStream();
		const res = await emit('POST', server.upload_url, {
			multipart: true,
			timeout: 50000,
			data: {
				// attachment.name MUST contain extension (At least, for images)
				[field]: new multipart.FileStream(stream, attachment.name, attachment.size, 'binary', attachment.mime),
			},
		});
		const uploaded = await this.execute(saveMethod, {
			[field]: res.jsonBody![field],
			...pick(res.jsonBody!, additionalField),
		});
		return toId(uploaded);
	}

	addExtraAttachment(message: any, attachment: ExtraAttachment) {
		if (attachment instanceof Location) {
			message.lat = attachment.lat;
			message.long = attachment.long;
		}
	}
	// TODO: Add support for message editing (Also look at comment for message_reply)
	async send(conv: Conversation, text: Text, attachments: Attachment[] = [], options: IMessageOptions & IVKMessageOptions = {}) {
		let peer_id: number;
		if (conv instanceof VKRealUser) {
			peer_id = conv.apiUser.id;
		} else if (conv instanceof VKBot) {
			peer_id = -conv.apiUser.id;
		} else if (conv instanceof VKChat) {
			peer_id = conv.apiChat.peer.id;
		} else {
			throw new Error('Bad receiver');
		}
		if (options.forwarded || options.replyTo) throw new Error('Message responses are not supported by vk bots');
		const texts = splitByMaxPossibleParts(this.partToString(text, conv.locale).replace(/(:?[^a-z]|^)(vto\.pe|olike\.ru|vkrutilka\.ru)(:?[^a-z]|$)/ig, (_, domain) => domain.replace(/[^.]/g, '*')), MAX_MESSAGE_LENGTH);
		const extraAttachments = attachments.filter(EXTRA_ATTACHMENT_PREDICATE) as ExtraAttachment[];
		const attachmentUploadPromises = arrayChunks(attachments, MAX_ATTACHMENTS_PER_MESSAGE)
			.map(chunk => chunk.map(name => this.uploadAttachment(name, peer_id.toString())));
		for (let i = 0; i < texts.length; i++) {
			const isLast = i === texts.length - 1;
			const apiObject: any = {
				random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
				peer_id,
				message: texts[i],
				// TODO: Link text
				dont_parse_links: 1,
				// TODO: Somehow use passed text mention object
				disable_mentions: 1,
				// TODO: Buttons?
			};
			if (isLast && attachmentUploadPromises.length >= 1) {
				apiObject.attachment = (await Promise.all(attachmentUploadPromises.shift()!)).join(',');
			}
			if (isLast && attachmentUploadPromises.length === 0 && extraAttachments.length >= 1) {
				this.addExtraAttachment(apiObject, extraAttachments.shift()! as ExtraAttachment);
			}
			if (isLast && options.vkKeyboard) {
				apiObject.keyboard = JSON.stringify(options.vkKeyboard);
			}
			await this.execute('messages.send', apiObject);
		}
		for (let i = 0; i < attachmentUploadPromises.length; i++) {
			const isLast = i === attachmentUploadPromises.length - 1;
			const apiObject: any = {
				random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
				peer_id,
			};
			apiObject.attachment = (await Promise.all(attachmentUploadPromises[i]!)).join(',');
			if (isLast && extraAttachments.length >= 1) {
				this.addExtraAttachment(apiObject, extraAttachments.shift()! as ExtraAttachment);
			}
			if (isLast && options.vkKeyboard) {
				apiObject.keyboard = JSON.stringify(options.vkKeyboard);
			}
			await this.execute('messages.send', apiObject);
		}
		let extraAttachment: ExtraAttachment | undefined;
		while ((extraAttachment = extraAttachments.shift())) {
			const isLast = extraAttachments.length === 0;
			const apiObject: any = {
				random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
				peer_id,
			};
			this.addExtraAttachment(apiObject, extraAttachment as ExtraAttachment);
			if (isLast && options.vkKeyboard) {
				apiObject.keyboard = JSON.stringify(options.vkKeyboard);
			}
			this.execute('messages.send', apiObject);
		}
	}

	partToString(part: TextPart, locale?: Translation): string {
		if (!part) return part + '';
		if (typeof part === 'number') {
			return part + '';
		} else if (typeof part === 'string')
			return part;
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor('|')}`;
		} else if (part instanceof Array) {
			return part.map(l => this.partToString(l, locale)).join('');
		}
		if (part instanceof FormattingTextPart) {
			let string = this.partToString(part.text, locale);
			if (part.desc.preserveMultipleSpaces) {
				string = string.replace(/(:?^ | {2})/g, e => '\u2002'.repeat(e.length));
			}
			return string;
		} else if (part instanceof CodeTextPart) {
			return part.data.replace(/(:?^ | {2})/g, e => '\u2002'.repeat(e.length));
		} else if (part instanceof HashTagTextPart) {
			return part.tags.map(tag => `#${tag}`).join(' ');
		} else if (part instanceof OpaqueTextPart) {
			const ayzekPart = opaqueToAyzek(part);
			if (!ayzekPart) {
				if (part.fallback)
					return this.partToString(part.fallback, locale);
				return '**IDK**';
			}
			switch (ayzekPart.ayzekPart) {
				case 'user': {
					return `[${ayzekPart.user.profileUrl.slice(15)}|${ayzekPart.title || ayzekPart.user.name}]`;
				}
				case 'chat': {
					return `${(ayzekPart.chat as VKChat).title}`;
				}
			}
		} else if (part instanceof Component) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return this.partToString(part.localize(locale, []), locale);
		} else if (part instanceof Preformatted) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return '{' + this.partToString(part.localize(locale), locale) + '}';
		}
		throw new Error('unreachable');
	}

	async doWork(): Promise<void> {
		await this.loop();
	}
	async cancel() {

	}

	apiLocalUserArgumentType = new VKUserArgumentType(this);

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.ChatButtons,
		ApiFeature.ChatMemberList,
		ApiFeature.EditMessage,
	]);

	defaultTranslation = new Translation(LANGUAGES['en'], LOCALES['US']);
}

export default class VKApiPlugin extends ApiPlugin {
	constructor() {
		super(
			'VK',
			'НекийЛач',
			'Поддержка VK',
			VKApiConfiguration,
			{
				descriminator: 'vkExample',
				accountId: 0,
				isUserAccount: false,
				tokens: ['example-token'],
			} as t.TypeOf<typeof VKApiConfiguration>,
			VKApi,
		);
	}
}
