import { lookup as lookupMime } from '@meteor-it/mime';
import { emit } from "@meteor-it/xrest";
import * as multipart from '@meteor-it/xrest/multipart';
import { nonenumerable } from 'nonenumerable';
import { NoSuchUserError } from "../../bot/argument";
import { ArgumentType } from "../../command/arguments";
import { ParseEntryPoint } from "../../command/command";
import { ExpectedSomethingError } from "../../command/error";
import StringReader from "../../command/reader";
import { Api } from "../../model/api";
import { Attachment, Audio, File, Image, Location, MessengerSpecificUnknownAttachment, Video, Voice } from "../../model/attachment/attachment";
import { Conversation } from "../../model/conversation";
import { JoinChatEvent, JoinReason } from "../../model/events/join";
import { LeaveChatEvent, LeaveReason } from "../../model/events/leave";
import { MessageEvent } from '../../model/events/message';
import { ChatTitleChangeEvent } from "../../model/events/titleChange";
import { TypingEvent, TypingEventType } from "../../model/events/typing";
import { IMessage, IMessageOptions } from "../../model/message";
import { Text, TextPart } from '../../model/text';
import arrayChunks from "../../util/arrayChunks";
import { splitByMaxPossibleParts } from "../../util/split";
import ApiFeature from "../features";
import VKApiProcessor from "./apiProcessor";
import VKBotMap from "./botMap";
import VKChat from "./chat";
import VKChatMap from "./chatMap";
import VKUser from "./user/user";
import VKUserMap from "./userMap";

const MAX_MESSAGE_LENGTH = 4096;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
type ExtraAttachment = Location;
const EXTRA_ATTACHMENT_PREDICATE = (a: Attachment) => a instanceof Location;

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
			parsed.conversation, parsed.attachments, parsed.text, parsed.forwarded, parsed.messageId, parsed.replyTo
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
			//
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
			this.logger.warn('Loop end (???), waiting before restart');
			await new Promise(res => setTimeout(res, 5000));
		}
	}

	async uploadAttachment(attachment: Attachment, peerId: string): Promise<string> {
		if (attachment instanceof Image) {
			return await this.uploadImage(attachment, peerId);
		}
		throw new Error('Not implemented');
	}

	async uploadImage(attachment: Image, peerId: string): Promise<string> {
		// TODO: Upload server pool/cache
		let server = await this.execute('photos.getMessagesUploadServer', { peer_id: peerId });
		const stream = attachment.data.toStream();
		let res = await emit('POST', server.upload_url, {
			multipart: true,
			timeout: 50000,
			data: {
				// attachment.name MUST contain extension
				photo: new multipart.FileStream(stream, attachment.name, attachment.size, 'binary', 'image/jpeg')
			}
		});
		let uploadedImage = await this.execute('photos.saveMessagesPhoto', {
			photo: res.jsonBody!.photo,
			server: res.jsonBody!.server,
			hash: res.jsonBody!.hash
		});
		return `photo${uploadedImage[0].owner_id}_${uploadedImage[0].id}`;
	}

	addExtraAttachment(message: any, attachment: ExtraAttachment) {
		if (attachment instanceof Location) {
			message.lat = attachment.lat;
			message.long = attachment.long;
		}
	}
	// TODO: Add support for message editing (Also look at comment for message_reply)
	async send(conv: Conversation<VKApi>, text: Text<VKApi>, attachments: Attachment[] = [], options: IMessageOptions = {}) {
		const peer_id = +conv.targetId;
		if (options.forwarded || options.replyTo) throw new Error(`Message responses are not supported by vk bots`);
		const texts = splitByMaxPossibleParts(this.textToString(text), MAX_MESSAGE_LENGTH);
		const extraAttachments = attachments.filter(EXTRA_ATTACHMENT_PREDICATE) as ExtraAttachment[];
		const attachmentsChunks = arrayChunks(attachments, MAX_ATTACHMENTS_PER_MESSAGE);
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
			if (isLast && attachmentsChunks.length >= 1) {
				apiObject.attachment = await Promise.all(attachmentsChunks.shift()!.map(name => this.uploadAttachment(name, peer_id.toString())));
			}
			if (isLast && attachmentsChunks.length === 0 && extraAttachments.length >= 1) {
				this.addExtraAttachment(apiObject, extraAttachments.shift()! as ExtraAttachment);
			}
			this.execute('messages.send', apiObject);
		}
		for (let i = 0; i < attachmentsChunks.length; i++) {
			let isLast = i === attachmentsChunks.length - 1;
			const apiObject: any = {
				random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
				peer_id,
			};
			apiObject.attachment = await Promise.all(attachmentsChunks[i]!.map(name => this.uploadAttachment(name, peer_id.toString())));
			if (isLast && extraAttachments.length >= 1) {
				this.addExtraAttachment(apiObject, extraAttachments.shift()! as ExtraAttachment);
			}
			this.execute('messages.send', apiObject);
		}
		let extraAttachment: ExtraAttachment | undefined;
		while (extraAttachment = extraAttachments.shift()) {
			const apiObject: any = {
				random_id: Math.floor(Math.random() * (Math.random() * 1e17)),
				peer_id,
			};
			this.addExtraAttachment(apiObject, extraAttachment as ExtraAttachment);
			this.execute('messages.send', apiObject);
		}
	}

	textToString(part: TextPart<VKApi>): string {
		if (!part) return part + '';
		if (typeof part === 'string') return part;
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor(`|`)}`
		} else if (part instanceof Array) {
			return part.map(l => this.textToString(l)).join('');
		}
		switch (part.type) {
			case 'code':
			case 'preservingWhitespace':
				return this.textToString(part.data).replace(/(:?^ |  )/g, e => '\u2002'.repeat(e.length));
			case 'mentionPart':
				return `[${part.data.profileUrl.slice(15)}|${part.text || part.data.name}]`
			case 'chatRefPart':
				return `<Чат ${part.data.title}>`;
			case 'underlinedPart':
			case 'boldPart':
				return this.textToString(part.data);
			case 'hashTagPart':
				return this.textToString(part.data).split(' ').map(e => e.length !== 0 ? `#${e}` : e).join(' ')
		}
	}

	async doWork(): Promise<void> {
		await this.loop();
	}

	get apiLocalUserArgumentType(): ArgumentType<VKUser> {
		return vkUserArgumentTypeInstance;
	}

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.ChatButtons,
		ApiFeature.ChatMemberList,
		ApiFeature.EditMessage,
	]);
}

class ExpectedVKUserError extends ExpectedSomethingError {
	constructor(public reader: StringReader) {
		super(reader, 'vk user mention');
	}
}

class VKUserArgumentType extends ArgumentType<VKUser>{
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<VKUser> {
		if (reader.peek() !== '[') throw new ExpectedVKUserError(reader);
		const api = ctx.sourceProvider as unknown as VKApi;
		const cursor = reader.cursor;
		reader.skip();
		const remaining = reader.remaining;
		let isBot;
		if (remaining.startsWith('id')) {
			isBot = false;
			reader.skipMulti(2);
		} else if (remaining.startsWith('club')) {
			isBot = true;
			reader.skipMulti(4);
		} else {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		let id;
		try {
			id = reader.readInt();
		} catch{
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		if (reader.readChar() !== '|') {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		const charsToSkip = reader.remaining.indexOf(']') + 1;
		if (charsToSkip === 0) {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		reader.cursor += charsToSkip;
		const user = await api.getApiUser(isBot ? -id : id);
		if (!user) throw new NoSuchUserError((isBot ? -id : id).toString(), reader);
		return user;
	}
}
const vkUserArgumentTypeInstance = new VKUserArgumentType();
