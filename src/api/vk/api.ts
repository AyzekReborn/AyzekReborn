import { Api } from "../../model/api";
import VKApiProcessor from "./apiProcessor";
import { IMessage, IMessageOptions } from "../../model/message";
import { emit } from "@meteor-it/xrest";
import { nonenumerable } from 'nonenumerable';

import VKUser from "./user/user";
import VKChat from "./chat";

import VKUserMap from "./userMap";
import VKChatMap from "./chatMap";
import VKBotMap from "./botMap";

import { Attachment, Image, Audio, File, Video, Location, MessengerSpecificUnknownAttachment, Voice } from "../../model/attachment/attachment";
import { lookup as lookupMime } from '@meteor-it/mime';
import { MessageEvent } from '../../model/events/message';
import { JoinChatEvent, JoinReason } from "../../model/events/join";
import { LeaveChatEvent, LeaveReason } from "../../model/events/leave";
import { Conversation } from "../../model/conversation";
import { Text, TextPart } from '../../model/text';
import ApiFeature from "../features";
import { ChatTitleChangeEvent, TitleChangeEvent } from "../../model/events/titleChange";

export default class VKApi extends Api<VKApi> {
	processor: VKApiProcessor;
	userMap: VKUserMap;
	botMap: VKBotMap;
	chatMap: VKChatMap;
	@nonenumerable
	tokens: string[];
	// TODO: Work as user account (illegal)
	constructor(public apiId: string, public groupId: number, tokens: string[]) {
		super('vk');
		this.processor = new VKApiProcessor(this.logger, tokens);
		this.userMap = new VKUserMap(this);
		this.botMap = new VKBotMap(this);
		this.chatMap = new VKChatMap(this);
		this.tokens = tokens;
	}
	async init() {
	}
	getApiUser(id: number): Promise<VKUser | null> {
		if (id < 0) {
			return this.botMap.get(-id);
		}
		return this.userMap.get(id);
	}
	async getApiChat(id: number): Promise<VKChat | null> {
		if (id >= 2e9) throw new Error('Already transformed id passed');
		return this.chatMap.get(id);
	}
	encodeUserUid(id: number): string {
		return `VKU:${this.apiId}:${id}`;
	}
	encodeChatCid(id: number): string {
		return `VKC:${this.apiId}:${id}`;
	}
	getUser(uid: string) {
		const userPrefix = `VKU:${this.apiId}:`;
		if (!uid.startsWith(userPrefix)) {
			return Promise.resolve(null);
		}
		const id = parseInt(uid.replace(userPrefix, ''), 10);
		if (isNaN(id))
			return Promise.resolve(null);
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
				return Image.fromUrl(maxSize.url, 'photo.jpeg', 'image/jpeg');
			}
			case 'audio': {
				if (attachment.audio.url === '')
					// TODO: Workaround empty audio?
					return Audio.fromEmpty(attachment.audio.artist, attachment.audio.title, 'audio/mpeg');
				return Audio.fromUrl(attachment.audio.url, attachment.audio.artist, attachment.audio.title, 'audio/mpeg');
			}
			case 'doc': {
				return File.fromUrlWithSizeKnown(
					attachment.doc.url, attachment.doc.size, attachment.doc.title,
					// Because VK does same thing
					lookupMime(attachment.doc.ext) || 'text/plain'
				);
			}
			case 'audio_message': {
				return Voice.fromUrl(attachment.audio_message.link_ogg, 'voice.ogg', 'audio/ogg');
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
	async parseReplyMessage(message: any): Promise<IMessage<VKApi>> {
		const [user, attachments, extraAttachments] = await Promise.all([
			this.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
			this.parseExtraAttachments(message)
		]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this,
			user,
			chat: null,
			conversation: user,
			attachments: [
				...attachments,
				...extraAttachments
			] as Attachment[],
			text: message.text || '',
			// Replies have no forwarded messages
			forwarded: [],
			messageId: '0',
			replyTo: null,
		};
	}
	async parseMessage(message: any, parseChat: boolean = false): Promise<IMessage<VKApi>> {
		// Do everything in parallel!
		// Typescript fails to analyze dat shit 🤷‍
		const [chat, user, attachments, extraAttachments, forwarded, replyTo] = await Promise.all([
			(parseChat && message.peer_id > 2e9) ? this.getApiChat(message.peer_id - 2e9) : null,
			this.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
			this.parseExtraAttachments(message),
			(message.fwd_messages ? Promise.all(message.fwd_messages.map((m: any) => this.parseMessage(m))) : Promise.resolve([])),
			message.reply_message ? (this.parseReplyMessage(message.reply_message)) : null
		] as [Promise<VKChat | null>, Promise<VKUser | null>, Promise<Attachment[]>, Promise<Attachment[]>, Promise<IMessage<VKApi>[]>, Promise<IMessage<VKApi> | null>]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this,
			user: user,
			chat: chat,
			conversation: chat || user,
			attachments: [
				...attachments,
				...extraAttachments
			] as Attachment[],
			text: message.text || '',
			forwarded,
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
			parsed.conversation, parsed.attachments, parsed.text, parsed.forwarded, parsed.messageId, parsed.replyTo
		));
	}
	async processUpdate(update: { type: string, object: any }) {
		switch (update.type) {
			case 'message_new':
				await this.processNewMessageUpdate(update.object);
				break;
			default:
				this.logger.error(`Unknown update type: ${update.type}`);
				this.logger.error(update.object);
		}
	}
	async loop() {
		await this.init();
		while (true) {
			//
			let data = await this.execute('groups.getLongPollServer', {
				group_id: this.groupId
			});
			if (!data.server) {
				this.logger.error("Can't get data!")
				this.logger.error(data);
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
				})).body;

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

				events.updates.forEach((update: any) => {
					try {
						this.processUpdate(update);
					} catch (e) {
						this.logger.error(`Update processing error: `, update);
						this.logger.error(e.stack);
					}
				});
			}
			this.logger.warn('Loop end (???), waiting before restart');
			await new Promise(res => setTimeout(res, 5000));
		}
	}
	// TODO: Send multi via user_ids
	async send(conv: Conversation<VKApi>, text: Text<VKApi>, attachments: Attachment[] = [], options: IMessageOptions = {}) {
		const peer_id = +conv.targetId;
		if (options.forwarded || options.replyTo) throw new Error(`Message responses are not supported by vk bots`);
		this.execute('messages.send', {
			random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
			peer_id,
			// TODO: Split text to fit
			message: this.textToString(text),
			// TODO: attachment
			// TODO: Link text
			dont_parse_links: 1,
			// TODO: Somehow use passed text mention object
			disable_mentions: 1,
			// TODO: Buttons?
		});
	}

	textPartToString(part: TextPart<VKApi>): string {
		if (typeof part === 'string') return part;
		switch (part.type) {
			case 'mentionPart':
				return `[id${part.data.targetId}|${part.text || part.data.name}]`
			case 'chatRefPart':
				return `<Чат ${part.data.title}>`;
			case 'underlinedPart':
				return this.textToString(part);
		}
	}
	textToString(text: Text<VKApi>): string {
		if (text instanceof Array) return text.map(l => this.textPartToString(l)).join('');
		else return this.textPartToString(text);
	}

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.ChatButtons,
		ApiFeature.ChatMemberList,
		ApiFeature.EditMessage,
	]);
}
