import type { ArgumentType } from "@ayzek/command-parser/arguments";
import StringReader from "@ayzek/command-parser/reader";
import { replaceBut } from "@ayzek/core/util/escape";
import { splitByMaxPossibleParts } from "@ayzek/core/util/split";
import { Api } from "@ayzek/model/api";
import type { Attachment, Image } from "@ayzek/model/attachment";
import { Chat, Conversation, Gender, User } from "@ayzek/model/conversation";
import { MessageEvent } from "@ayzek/model/events/message";
import type ApiFeature from "@ayzek/model/features";
import type { IMessage, IMessageOptions } from "@ayzek/model/message";
import { opaqueToAyzek } from "@ayzek/model/text";
import type { Text, TextPart } from "@ayzek/text";
import type { MaybePromise } from "@meteor-it/utils";
import XRest from "@meteor-it/xrest";
import * as https from 'https';

export class TelegramUser extends User {
	constructor(public apiUser: any, api: TelegramApi) {
		super(
			api,
			apiUser.id.toString(),
			`TGU:${api.descriptor}:${apiUser.id.toString()}`,
			apiUser.username,
			apiUser.first_name ?? null,
			apiUser.last_name ?? null,
			apiUser.is_bot ? Gender.BOT : Gender.UNSPECIFIED,
			`https://t.me/${apiUser.username}`,
			apiUser.is_bot,
		)
	}
	get photoImage(): Promise<Image | null> {
		throw new Error("Method not implemented.");
	}
}
export class TelegramChat extends Chat {
	constructor(public apiChat: any, api: TelegramApi) {
		super(
			api,
			apiChat.id,
			`TGC:${api.descriptor}:${-apiChat.id}`,
			[],
			apiChat.title,
			[],
			null,
		);
	}

	get photoImage(): Promise<Image | null> {
		throw new Error("Method not implemented.");
	}
}

function isChatType(type: string) {
	if (!type) return;
	return ['group', 'supergroup'].includes(type);
}

export default class TelegramApi extends Api {
	xrest: XRest;
	constructor(public descriptor: string, public username: string, public token: string) {
		super('tg');
		this.xrest = new XRest(`https://api.telegram.org/bot${token}/`, {
			agent: new https.Agent({
				keepAlive: true,
				keepAliveMsecs: 5000,
				maxSockets: Infinity,
				maxFreeSockets: 256,
			})
		});
	}
	protected supportedFeatures: Set<ApiFeature> = new Set();

	getUser(uid: string): MaybePromise<TelegramUser | null> {
		const userPrefix = `TGU:${this.descriptor}:`;
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
		const chatPrefix = `TGC:${this.descriptor}:`;
		if (!cid.startsWith(chatPrefix)) {
			return Promise.resolve(null);
		}
		let id = -parseInt(cid.replace(chatPrefix, ''), 10);
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

	lastUpdateId: number = 0;

	users: Map<number, TelegramUser> = new Map();
	chats: Map<number, TelegramChat> = new Map();

	updateUserMap(user: any) {
		if (!this.users.get(user.id)) {
			this.users.set(user.id, new TelegramUser(user, this));
		} else {
			// TODO: Update
		}
	}

	updateChatMap(chat: any) {
		if (!chat.id) {
			this.logger.debug('No id:', chat);
			return;
		}
		if (!this.chats.get(-chat.id)) {
			this.chats.set(-chat.id, new TelegramChat(chat, this));
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
			conversation: chat ?? user,
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
		return new MessageEvent(
			this,
			user,
			chat,
			chat ?? user,
			[],
			isForwarded ? '' : (message.text ?? message.caption),
			await this.parseForwarded(message),
			message.message_id,
			message.reply_to_message ? (await this.parseMessage(message.reply_to_message)) : null,
		);
	}
	async processMessageUpdate(messageUpdate: any) {
		const message = await this.parseMessage(messageUpdate);
		this.messageEvent.emit(message);
	}
	async processUpdate(update: any) {
		this.logger.debug(update);
		if (update.message) {
			await this.processMessageUpdate(update.message);
		}
	}
	async doWork() {
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
	get apiLocalUserArgumentType(): ArgumentType<void, User> {
		throw new Error("Method not implemented.");
	}

	async send(conv: Conversation, text: Text, _attachments: Attachment[], _options: IMessageOptions): Promise<void> {
		const parts = splitByMaxPossibleParts(this.partToString(text), 4096);
		for (let part of parts) {
			await this.execute('sendMessage', {
				chat_id: conv.targetId,
				text: part,
				parseMode: 'MarkdownV2',
				disable_web_page_preview: true,
				disable_notification: true,
			});
		}
	}

	partToString(part: TextPart): string {
		if (!part) return part + '';
		if (typeof part === 'number') {
			return part + '';
		} else if (typeof part === 'string')
			return part
				.replace(/`/g, '\\`')
				.replace(/_/g, '\\_')
				.replace(/\*/g, '\\*');
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
				if (part.bold) {
					string = `**${replaceBut(string, /\*\*/g, /\\\*\*/g, '')}**`;
				}
				if (part.underlined) {
					string = `__${replaceBut(string, /__/g, /\\__/g, '')}__`;
				}
				if (part.italic) {
					string = `*${replaceBut(string, /\*/g, /\\\*/g, '')}*`;
				}
				return string;
			}
			case 'code':
				return `\`\`\`${part.lang}\n${part.data.replace(/```/g, '\\`\\`\\`')}\`\`\``;
			case 'opaque': {
				const ayzekPart = opaqueToAyzek(part);
				if (!ayzekPart) {
					if(part.fallback)
						return this.partToString(part.fallback);
					return '**IDK**';
				}
				switch (ayzekPart.ayzekPart) {
					case 'user': {
						return `[${ayzekPart.title ?? ayzekPart.user.name}](tg://user?id=${ayzekPart.user.targetId})`
					}
					case 'chat': {
						return `<Чат ${(ayzekPart.chat as TelegramChat).title}>`;
					}
				}
			}
			case 'hashTagPart':
				if (part.hideOnNoSupport) return '';
				return this.partToString(part.data);
		}
		throw new Error(`Part ${JSON.stringify(part)} not handled`);
	}
}
