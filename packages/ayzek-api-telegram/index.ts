import type { ArgumentType } from '@ayzek/command-parser/arguments';
import StringReader from '@ayzek/command-parser/reader';
import { Api, ApiPlugin } from '@ayzek/core/api';
import { Chat, Conversation, Gender, User } from '@ayzek/core/conversation';
import { CommandMessageEvent, MessageEvent, PlainMessageEvent } from '@ayzek/core/events/message';
import ApiFeature from '@ayzek/core/features';
import { IMessage, IMessageOptions } from '@ayzek/core/message';
import { Attachment, Image } from '@ayzek/core/model/attachment';
import { opaqueToAyzek } from '@ayzek/core/text';
import { validateData } from '@ayzek/core/util/config';
import { replaceBut } from '@ayzek/core/util/escape';
import { splitByMaxPossibleParts } from '@ayzek/core/util/split';
import { CodeTextPart, FormattingTextPart, HashTagTextPart, Translation, OpaqueTextPart, Text, TextPart } from '@ayzek/text';
import { Component } from '@ayzek/text/component';
import { LANGUAGES } from '@ayzek/text/language';
import { LOCALES } from '@ayzek/text/locale';
import { Preformatted } from '@ayzek/text/translation';
import type { MaybePromise } from '@meteor-it/utils';
import XRest from '@meteor-it/xrest';
import * as https from 'https';
import * as t from 'io-ts';

const ApiUser = t.interface({
	id: t.number,
	first_name: t.string,
	last_name: t.union([t.undefined, t.string]),
	username: t.union([t.undefined, t.string]),
	language_code: t.union([t.undefined, t.string]),
	is_bot: t.boolean,
});
const ApiChat = t.interface({
	id: t.number,
	title: t.string,
});

export class TelegramUser extends User {
	constructor(public apiUser: t.TypeOf<typeof ApiUser>, api: TelegramApi) {
		super(
			api,
			`TGU:${api.config.descriminator}:${apiUser.id.toString()}`,
			apiUser.username ?? null,
			apiUser.first_name ?? null,
			apiUser.last_name ?? null,
			apiUser.is_bot ? Gender.BOT : Gender.UNSPECIFIED,
			`https://t.me/${apiUser.username}`,
			apiUser.is_bot,
		);

		const languageName = apiUser.language_code?.split('-')[0];
		if (languageName) {
			this.locale._language = LANGUAGES[languageName];
		}
	}
	get photoImage(): Promise<Image | null> {
		throw new Error('Method not implemented.');
	}
}
export class TelegramChat extends Chat {
	constructor(public apiChat: t.TypeOf<typeof ApiChat>, api: TelegramApi) {
		super(
			api,
			`TGC:${api.config.descriminator}:${-apiChat.id}`,
			[],
			apiChat.title,
			[],
			null,
		);
	}

	get photoImage(): Promise<Image | null> {
		throw new Error('Method not implemented.');
	}
}

function isChatType(type: string) {
	if (!type) return;
	return ['group', 'supergroup'].includes(type);
}

const TelegramApiConfiguration = t.interface({
	descriminator: t.string,
	username: t.string,
	token: t.string,
});

export class TelegramApi extends Api {
	xrest: XRest;
	constructor(public config: t.TypeOf<typeof TelegramApiConfiguration>) {
		super('tg');
		this.xrest = new XRest(`https://api.telegram.org/bot${config.token}/`, {
			agent: new https.Agent({
				keepAlive: true,
				keepAliveMsecs: 5000,
				maxSockets: Infinity,
				maxFreeSockets: 256,
			}),
		});
	}
	protected supportedFeatures: Set<ApiFeature> = new Set();

	getUser(uid: string): MaybePromise<TelegramUser | null> {
		const userPrefix = `TGU:${this.config.descriminator}:`;
		if (!uid.startsWith(userPrefix)) {
			return null;
		}
		const id = parseInt(uid.replace(userPrefix, ''), 10);
		if (isNaN(id))
			return null;
		if (this.users.has(id))
			return this.users.get(id)!;

		return this.fetchUserOrChat(id) as Promise<TelegramUser>;
	}
	async fetchUserOrChat(id: number): Promise<TelegramUser | TelegramChat | null> {
		const got = await this.execute('getChat', { chat_id: id });
		if (id > 0) {
			this.updateUserMap(got);
			return this.users.get(id) ?? null;
		} else {
			this.updateChatMap(got);
			return this.chats.get(-id) ?? null;
		}
	}
	getChat(cid: string): MaybePromise<TelegramChat | null> {
		const chatPrefix = `TGC:${this.config.descriminator}:`;
		if (!cid.startsWith(chatPrefix)) {
			return Promise.resolve(null);
		}
		const id = -parseInt(cid.replace(chatPrefix, ''), 10);
		if (isNaN(id))
			return Promise.resolve(null);
		if (this.chats.has(id))
			return this.chats.get(id)!;
		return this.fetchUserOrChat(id) as Promise<TelegramChat>;
	}
	public async execute(method: string, params: any): Promise<any> {
		const res = await this.xrest.emit('POST', method, {
			// multipart: true,
			data: params,
		});
		const data = res.jsonBody;
		if (!data.ok) {
			throw new Error(data.description);
		}
		return data.result;
	}

	lastUpdateId = 0;

	users: Map<number, TelegramUser> = new Map();
	chats: Map<number, TelegramChat> = new Map();

	updateUserMap(user: unknown) {
		const correctUser = validateData(user, ApiUser);
		if (!this.users.get(correctUser.id)) {
			this.users.set(correctUser.id, new TelegramUser(correctUser, this));
		} else {
			// TODO: Update
		}
	}

	updateChatMap(chat: unknown) {
		const correctChat = validateData(chat, ApiChat);
		if (!this.chats.get(-correctChat.id)) {
			this.chats.set(-correctChat.id, new TelegramChat(correctChat, this));
		} else {
			// TODO: Update
		}
	}

	async parseForwarded(message: any): Promise<IMessage[]> {
		if (!message.forward_from) return [];
		if (message.forward_from)
			this.updateUserMap(message.forward_from);
		if (isChatType(message.forward_from_chat.type))
			this.updateChatMap(message.forward_from_chat);
		const user = this.users.get(message.forward_from.id)!;
		const chat = this.chats.get(-message.forward_from_chat.id) ?? null;
		return [{
			api: this,
			user,
			chat,
			attachments: [],
			text: message.text ?? message.caption,
			replyTo: message.reply_to_message ? (await this.parseMessage(message.reply_to_message)) : null,
			forwarded: [],
			messageId: message.forward_from_message_id,
		}];
	}

	async parseMessage(message: any): Promise<MessageEvent> {
		if (message.from)
			this.updateUserMap(message.from);
		if (isChatType(message.chat.type))
			this.updateChatMap(message.chat);
		const user = this.users.get(message.from.id)!;
		const chat = this.chats.get(-message.chat.id) ?? null;
		const isForwarded = !!message.forwarded_from;
		// TODO: Group multiple forwarded at api level?
		const messageData: IMessage = {
			api: this,
			user,
			chat,
			attachments: [],
			text: isForwarded ? '' : (message.text ?? message.caption),
			replyTo: message.reply_to_message ? (await this.parseMessage(message.reply_to_message)) : null,
			forwarded: await this.parseForwarded(message),
			messageId: message.message_id,
		};

		return new PlainMessageEvent(messageData);
	}
	async processMessageUpdate(messageUpdate: any) {
		const message = await this.parseMessage(messageUpdate);
		if (message.text.startsWith('/') && !message.text.startsWith('//') && message.text.length != 1) {
			let command = message.text.slice(1);
			const firstArg = command.split(' ', 1)[0];
			const splitted = firstArg.split('@');
			if (splitted.length === 1 || splitted[splitted.length - 1] === this.config.username) {
				if (splitted.length !== 1)
					command = command.substring(0, command.lastIndexOf('@')) + command.substring(command.lastIndexOf('@') + splitted[splitted.length - 1].length + 1, command.length);
				this.bus.emit(new CommandMessageEvent(message, command));
			}
		}
		this.bus.emit(new PlainMessageEvent(message));
	}
	async processUpdate(update: any) {
		this.logger.debug(update);
		if (update.message) {
			await this.processMessageUpdate(update.message);
		}
	}
	async doWork() {
		/*eslint no-constant-condition: off*/
		while (true) {
			try {
				const data = await this.execute('getUpdates', {
					offset: this.lastUpdateId,
					timeout: 5,
					allowed_updates: [],
				});
				if (data.length !== 0) {
					this.lastUpdateId = data[data.length - 1].update_id + 1;
					for (const update of data) {
						await this.processUpdate(update);
					}
				}
			} catch (e) {
				if (e.message === 'Unauthorized') {
					this.logger.error('Bad token');
					return;
				}
				this.logger.error('Update processing failure');
				this.logger.error(e);
			}
		}
	}
	async cancel() { }

	get apiLocalUserArgumentType(): ArgumentType<void, User> {
		throw new Error('Method not implemented.');
	}

	async send(conv: Conversation, text: Text, _attachments: Attachment[], _options: IMessageOptions): Promise<void> {
		const parts = splitByMaxPossibleParts(this.partToString(text, conv.locale), 4096);
		if (!(conv instanceof TelegramUser || conv instanceof TelegramChat))
			throw new Error('Tried to send message to non telegram user');
		for (const part of parts) {
			await this.execute('sendMessage', {
				chat_id: (conv instanceof TelegramUser) ? conv.apiUser.id : conv.apiChat.id,
				text: part,
				parseMode: 'MarkdownV2',
				disable_web_page_preview: true,
				disable_notification: true,
			});
		}
	}

	partToString(part: TextPart, locale?: Translation): string {
		if (!part) return part + '';
		if (typeof part === 'number') {
			return part + '';
		} else if (typeof part === 'string')
			return part
				.replace(/`/g, '\\`')
				.replace(/_/g, '\\_')
				.replace(/\*/g, '\\*');
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor('|')}`;
		} else if (part instanceof Array) {
			return part.map(l => this.partToString(l, locale)).join('');
		}
		if (part instanceof FormattingTextPart) {
			let string = this.partToString(part.text, locale);
			const desc = part.desc;
			if (desc.preserveMultipleSpaces) {
				string = string.replace(/(:?^ | {2})/g, e => '\u2002'.repeat(e.length));
			}
			if (desc.bold) {
				string = `**${replaceBut(string, /\*\*/g, /\\\*\*/g, '')}**`;
			}
			if (desc.underlined) {
				string = `__${replaceBut(string, /__/g, /\\__/g, '')}__`;
			}
			if (desc.italic) {
				string = `*${replaceBut(string, /\*/g, /\\\*/g, '')}*`;
			}
			return string;
		} else if (part instanceof CodeTextPart) {
			return `\`\`\`${part.lang}\n${part.data.replace(/```/g, '\\`\\`\\`')}\`\`\``;
		} else if (part instanceof OpaqueTextPart) {
			const ayzekPart = opaqueToAyzek(part);
			if (!ayzekPart) {
				if (part.fallback)
					return this.partToString(part.fallback, locale);
				return '**IDK**';
			}
			switch (ayzekPart.ayzekPart) {
				case 'user': {
					if (ayzekPart.user instanceof TelegramUser)
						return `[${ayzekPart.title ?? ayzekPart.user.name}](tg://user?id=${ayzekPart.user.apiUser.id})`;
					else
						return `${ayzekPart.user.name} (${ayzekPart.user.profileUrl})`;
				}
				case 'chat': {
					return `${(ayzekPart.chat as TelegramChat).title}`;
				}
			}
		} else if (part instanceof HashTagTextPart) {
			if (part.hideOnNoSupport) return '';
			return this.partToString(part.tags.map(e => `#${e}`), locale);
		} else if (part instanceof Component) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return this.partToString(part.localize(locale, []), locale);
		} else if (part instanceof Preformatted) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return this.partToString(part.localize(locale), locale);
		}
		throw new Error('unreachable');
	}

	defaultTranslation = new Translation(LANGUAGES['en'], LOCALES['US']);
}

export default class TelegramApiPlugin extends ApiPlugin {
	constructor() {
		super(
			'Telegram',
			'НекийЛач',
			'Поддержка Telegram',
			TelegramApiConfiguration,
			{
				descriminator: 'telegramExample',
				username: 'test',
				token: 'example-token',
			},
			TelegramApi,
		);
	}
}
