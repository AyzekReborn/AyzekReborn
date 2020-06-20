import StringReader from "@ayzek/command-parser/reader";
import arrayChunks from "@ayzek/core/util/arrayChunks";
import { splitByMaxPossibleParts } from "@ayzek/core/util/split";
import type { Writeable } from "@ayzek/core/util/writeable";
import { Api } from "@ayzek/model/api";
import { Attachment, Audio, File, Image, Location, MessengerSpecificUnknownAttachment, Video, Voice } from "@ayzek/model/attachment";
import type { Conversation } from "@ayzek/model/conversation";
import { JoinChatEvent, JoinReason } from "@ayzek/model/events/join";
import { LeaveChatEvent, LeaveReason } from "@ayzek/model/events/leave";
import { MessageEvent } from '@ayzek/model/events/message';
import { ChatTitleChangeEvent } from "@ayzek/model/events/titleChange";
import { TypingEvent, TypingEventType } from "@ayzek/model/events/typing";
import ApiFeature from "@ayzek/model/features";
import type { IMessage, IMessageOptions } from "@ayzek/model/message";
import { opaqueToAyzek } from "@ayzek/model/text";
import type { Text, TextPart } from '@ayzek/text';
import { lookup as lookupMime } from '@meteor-it/mime';
import type { MaybePromise } from '@meteor-it/utils';
import { emit } from "@meteor-it/xrest";
import * as multipart from '@meteor-it/xrest/multipart';
import { pick } from 'lodash';
import VKApiProcessor from "./apiProcessor";
import { VKUserArgumentType } from './arguments';
import type { IVKKeyboard } from './keyboard';
import { VKBot, VKBotMap } from "./user/bot";
import { VKChat, VKChatMap } from "./user/chat";
import { VKRealUser, VKUserMap } from "./user/realUser";
import VKUser from "./user/user";

const MAX_MESSAGE_LENGTH = 4096;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
type ExtraAttachment = Location;
const EXTRA_ATTACHMENT_PREDICATE = (a: Attachment) => a instanceof Location;

export type IVKMessageOptions = IMessageOptions & {
	vkKeyboard?: IVKKeyboard,
};

export default class VKApi extends Api {
	processor: VKApiProcessor;
	userMap: VKUserMap;
	botMap: VKBotMap;
	chatMap: VKChatMap;
	tokens: string[];
	// TODO: Work as user account (illegal :D)
	constructor(public apiId: string, public groupId: number, tokens: string[]) {
		super('vk');
		this.processor = new VKApiProcessor(this.logger, tokens, true);
		this.userMap = new VKUserMap(this);
		this.botMap = new VKBotMap(this);
		this.chatMap = new VKChatMap(this);
		this.tokens = tokens;
	}
	async init() {
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
		return `VKU:${this.apiId}:${id}`;
	}
	encodeChatCid(id: number): string {
		return `VKC:${this.apiId}:${id}`;
	}
	getUser(uid: string): MaybePromise<VKUser | null> {
		const userPrefix = `VKU:${this.apiId}:`;
		if (!uid.startsWith(userPrefix)) {
			return null;
		}
		const id = parseInt(uid.replace(userPrefix, ''), 10);
		if (isNaN(id))
			return null;
		return this.getApiUser(id);
	}
	getChat(cid: string) {
		const chatPrefix = `VKC:${this.apiId}:`;
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
			method, params
		});
	}
	async parseAttachment(attachment: any): Promise<Attachment> {
		switch (attachment.type) {
			case 'photo': {
				const sizes = attachment.photo.sizes;
				let maxSize = sizes[sizes.length - 1];
				return Image.fromUrl('GET', maxSize.url, {}, 'photo.jpeg', 'image/jpeg');
			}
			case 'audio': {
				if (attachment.audio.url === '')
					// TODO: Workaround empty audio?
					return Audio.fromEmpty(attachment.audio.artist, attachment.audio.title, 'audio/mpeg');
				return Audio.fromUrl('GET', attachment.audio.url, {}, attachment.audio.artist, attachment.audio.title, 'audio/mpeg');
			}
			case 'doc': {
				return File.fromUrlWithSizeKnown('GET',
					attachment.doc.url, {}, attachment.doc.size, attachment.doc.title,
					// Because VK does same thing
					lookupMime(attachment.doc.ext) || 'text/plain'
				);
			}
			case 'audio_message': {
				return Voice.fromUrl('GET', attachment.audio_message.link_ogg, {}, 'voice.ogg', 'audio/ogg', attachment.audio_message.duration * 1000);
			}
			case 'video': {
				// TODO: Extract something useful? Maybe create
				// TODO: VKVideoData extends Data?
				return Video.fromEmpty(attachment.video.title, 'video/mp4')
			}
			case 'poll': {
				return new MessengerSpecificUnknownAttachment('vk:poll', attachment.poll);
			}
			case 'link': {
				return new MessengerSpecificUnknownAttachment('vk:link', attachment.link);
			}
			// TODO: Sticker attachment
			case 'sticker': {
				return new MessengerSpecificUnknownAttachment('vk:sticker', attachment.sticker);
			}
			default:
				this.logger.error(`Unsupported attachment type: ${attachment.type}`);
				this.logger.error(attachment);
				return new MessengerSpecificUnknownAttachment(`vk:unk:${attachment.type}`, attachment[attachment.type]);
		}
	}
	async parseExtraAttachments(message: any): Promise<Attachment[]> {
		const result = [];
		if (message.geo) {
			result.push(new Location(message.geo.coordinates.latitude, message.geo.coordinates.longitude));
		}
		return result;
	}
	async parseReplyMessage(message: any): Promise<IMessage> {
		const [user, attachments, extraAttachments] = await Promise.all([
			this.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))) as Promise<Attachment[]>,
			this.parseExtraAttachments(message)
		]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this,
			user,
			chat: null,
			conversation: user,
			attachments: [
				...(attachments as Attachment[]),
				...(extraAttachments as Attachment[])
			] as Attachment[],
			text: message.text || '',
			// Replies have no forwarded messages
			forwarded: [],
			messageId: '0',
			replyTo: null,
		};
	}
	async parseMessage(message: any, parseChat: boolean = false): Promise<IMessage> {
		// Do everything in parallel!
		// Typescript fails to analyze dat shit 🤷‍
		const [chat, user, attachments, extraAttachments, forwarded, replyTo] = await Promise.all([
			(parseChat && message.peer_id > 2e9) ? this.getApiChat(message.peer_id - 2e9) : null,
			this.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
			this.parseExtraAttachments(message),
			(message.fwd_messages ? Promise.all(message.fwd_messages.map((m: any) => this.parseMessage(m))) : Promise.resolve([])),
			message.reply_message ? (this.parseReplyMessage(message.reply_message)) : null
		] as [Promise<VKChat | null>, Promise<VKUser | null>, Promise<Attachment[]>, Promise<Attachment[]>, Promise<IMessage[]>, Promise<IMessage | null>]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this,
			user: user,
			chat: chat,
			conversation: chat ?? user,
			attachments: [
				...(attachments as Attachment[]),
				...(extraAttachments as Attachment[])
			] as Attachment[],
			text: message.text ?? '',
			forwarded: forwarded ?? [],
			messageId: '0',
			replyTo,
		};
	}
	async processNewMessageUpdate(update: any) {
		if (update.action) {
			switch (update.action.type) {
				case 'chat_title_update': {
					const [user, chat] = await Promise.all([
						this.getApiUser(update.from_id),
						this.getApiChat(update.peer_id - 2e9)
					]);
					if (!user) throw new Error(`Bad user: ${update.from_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					const newTitle = update.action.text;
					this.chatTitleChangeEvent.emit(new ChatTitleChangeEvent(
						this,
						// If old title is in cache
						chat.title === newTitle ? null : chat.title,
						newTitle,
						user,
						chat
					));
					(chat as Writeable<VKChat>).title = newTitle;
					return;
				}
				case 'chat_invite_user_by_link': {
					const [user, chat] = await Promise.all([
						this.getApiUser(update.from_id),
						this.getApiChat(update.peer_id - 2e9)
					]);
					if (!user) throw new Error(`Bad user: ${update.from_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					this.joinChatEvent.emit(new JoinChatEvent(
						this,
						user,
						null,
						JoinReason.INVITE_LINK,
						null,
						chat
					));
					if (!chat.users.includes(user))
						chat.users.push(user);
					return;
				}
				case 'chat_invite_user': {
					const [user, chat] = await Promise.all([
						this.getApiUser(update.action.member_id),
						this.getApiChat(update.peer_id - 2e9)
					]);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					if (update.from_id === update.action.member_id) {
						this.joinChatEvent.emit(new JoinChatEvent(
							this,
							user,
							null,
							JoinReason.RETURNED,
							null,
							chat
						));
					} else {
						this.joinChatEvent.emit(new JoinChatEvent(
							this,
							user,
							await this.getApiUser(update.from_id),
							JoinReason.INVITED,
							null,
							chat
						));
					}
					if (!chat.users.includes(user))
						chat.users.push(user);
					return;
				}
				case 'chat_kick_user': {
					const [user, chat] = await Promise.all([
						this.getApiUser(update.action.member_id),
						this.getApiChat(update.peer_id - 2e9)
					]);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					if (update.from_id === update.action.member_id) {
						this.leaveChatEvent.emit(new LeaveChatEvent(
							this,
							user,
							null,
							LeaveReason.SELF,
							null,
							chat
						));
					} else {
						this.leaveChatEvent.emit(new LeaveChatEvent(
							this,
							user,
							await this.getApiUser(update.from_id),
							LeaveReason.KICKED,
							null,
							chat
						))
					}
					if (chat.users.includes(user))
						chat.users.splice(chat.users.indexOf(user), 1);
					return;
				}
				default:
					this.logger.error(`Unknown message action: ${update.action.type}`);
					this.logger.error(update.action);
			}
			return;
		}
		const parsed = await this.parseMessage(update, true);
		this.messageEvent.emit(new MessageEvent(
			this, parsed.user,
			parsed.chat,
			parsed.conversation, parsed.attachments, parsed.text, parsed.forwarded, parsed.messageId, parsed.replyTo,
			update.payload,
		));
	}
	async processMessageTypingStateUpdate(update: any) {
		// TODO: Distinct event types? (VK always sends "typing")
		if (update.state !== 'typing') throw new Error(`Unknown typing state: ${update.state}`);
		const user = await this.getApiUser(update.from_id);
		if (!user) throw new Error(`Bad user: ${update.from_id}`);
		this.typingEvent.emit(new TypingEvent(
			this,
			user,
			null,
			user,
			TypingEventType.WRITING_TEXT
		));
	}
	async processUpdate(update: { type: string, object: any }) {
		switch (update.type) {
			case 'message_new':
				await this.processNewMessageUpdate(update.object.message);
				break;
			case 'message_reply':
				// TODO: Use for message editing. Not supported by vk yet.
				// TODO: (Message id === 0)
				break;
			case 'message_typing_state':
				await this.processMessageTypingStateUpdate(update.object);
				break;
			default:
				this.logger.error(`Unknown update type: ${update.type}`);
				this.logger.error(update.object);
		}
	}
	async loop() {
		await this.init();
		while (true) {
			try {
				let data = await this.execute('groups.getLongPollServer', {
					group_id: this.groupId
				});
				if (!data || !data.server) {
					this.logger.error("Can't get data!")
					this.logger.error(data);
					continue;
				}
				let { key, server, ts } = data;
				eventLoop: while (true) {
					let events = (await emit('GET', server, {
						query: {
							act: 'a_check',
							key,
							ts,
							wait: 25,
							mode: 66,
						},
						timeout: 0
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
						};
					}
					ts = events.ts;

					events.updates.forEach(async (update: any) => {
						try {
							await this.processUpdate(update);
						} catch (e) {
							this.logger.error(`Update processing error: `, update);
							this.logger.error(e.stack);
						}
					});
				}
				this.logger.warn('Loop end (???), waiting 5s before restart');
				await new Promise(res => setTimeout(res, 5000));
				this.logger.warn('Loop restart');
			} catch (e) {
				this.logger.error(`Hard error`);
				this.logger.error(e.stack);
			}
		}
	}

	async uploadAttachment(attachment: Attachment, peerId: string): Promise<string> {
		if (attachment instanceof Image) {
			return await this.genericUpload('photos.getMessagesUploadServer', 'photos.saveMessagesPhoto', attachment, peerId, 'photo', ['server', 'hash'], photo => `photo${photo[0].owner_id}_${photo[0].id}`);
		} else if (attachment instanceof File) {
			return await this.genericUpload('docs.getMessagesUploadServer', 'docs.save', attachment, peerId, 'file', [], doc => `doc${doc.doc.owner_id}_${doc.doc.id}`)
		}
		throw new Error('Not implemented');
	}

	async genericUpload(getServerMethod: string, saveMethod: string, attachment: Image | File, peerId: string, field: string, additionalField: string[], toId: (uploaded: any) => string): Promise<string> {
		// TODO: Upload server pool/cache
		let server = await this.execute(getServerMethod, { peer_id: peerId });
		const stream = attachment.data.toStream();
		let res = await emit('POST', server.upload_url, {
			multipart: true,
			timeout: 50000,
			data: {
				// attachment.name MUST contain extension (At least, for images)
				[field]: new multipart.FileStream(stream, attachment.name, attachment.size, 'binary', attachment.mime)
			}
		});
		let uploaded = await this.execute(saveMethod, {
			[field]: res.jsonBody![field],
			...pick(res.jsonBody!, additionalField)
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
		const peer_id = +conv.targetId;
		if (options.forwarded || options.replyTo) throw new Error(`Message responses are not supported by vk bots`);
		const texts = splitByMaxPossibleParts(this.partToString(text), MAX_MESSAGE_LENGTH);
		const extraAttachments = attachments.filter(EXTRA_ATTACHMENT_PREDICATE) as ExtraAttachment[]
		const attachmentUploadPromises = arrayChunks(attachments, MAX_ATTACHMENTS_PER_MESSAGE)
			.map(chunk => chunk.map(name => this.uploadAttachment(name, peer_id.toString())));
		for (let i = 0; i < texts.length; i++) {
			let isLast = i === texts.length - 1;
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
			let isLast = i === attachmentUploadPromises.length - 1;
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
		while (extraAttachment = extraAttachments.shift()) {
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

	partToString(part: TextPart): string {
		if (!part) return part + '';
		if (typeof part === 'number') {
			return part + '';
		} else if (typeof part === 'string')
			return part;
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor(`|`)}`
		} else if (part instanceof Array) {
			return part.map(l => this.partToString(l)).join('');
		}
		switch (part.type) {
			case 'formatting': {
				let string = this.partToString(part.data);
				if (part.preserveMultipleSpaces) {
					string = string.replace(/(:?^ |  )/g, e => '\u2002'.repeat(e.length));
				}
				return string;
			}
			case 'code':
				return part.data.replace(/(:?^ |  )/g, e => '\u2002'.repeat(e.length));
			case 'opaque': {
				const ayzekPart = opaqueToAyzek(part);
				if (!ayzekPart) {
					if (part.fallback)
						return this.partToString(part.fallback);
					return '**IDK**';
				}
				switch (ayzekPart.ayzekPart) {
					case 'user': {
						return `[${ayzekPart.user.profileUrl.slice(15)}|${ayzekPart.title || ayzekPart.user.name}]`
					}
					case 'chat': {
						return `<Чат ${(ayzekPart.chat as VKChat).title}>`;
					}
				}
			}
			case 'hashTagPart':
				return this.partToString(part.data).split(' ').map(e => e.length > 0 ? `#${e}` : e).join(' ');
		}
		throw new Error(`Part ${JSON.stringify(part)} not handled`);
	}

	async doWork(): Promise<void> {
		await this.loop();
	}

	apiLocalUserArgumentType = new VKUserArgumentType(this);

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.ChatButtons,
		ApiFeature.ChatMemberList,
		ApiFeature.EditMessage,
	]);
}
