import { JoinChatEvent, JoinReason } from '@ayzek/core/events/join';
import { LeaveChatEvent, LeaveReason } from '@ayzek/core/events/leave';
import { CommandMessageEvent, PlainMessageEvent } from '@ayzek/core/events/message';
import { ChatTitleChangeEvent } from '@ayzek/core/events/titleChange';
import { TypingEvent, TypingEventType } from '@ayzek/core/events/typing';
import { IMessage } from '@ayzek/core/message';
import { Attachment, Audio, File, Image, Location, MessengerSpecificUnknownAttachment, Video, Voice } from '@ayzek/core/model/attachment';
import { Writeable } from '@ayzek/core/util/writeable';
import Logger from '@meteor-it/logger';
import { lookup as lookupMime } from '@meteor-it/mime';
import { VKApi } from '.';
import { VKChat } from './chat';
import VKUser from './user/user';

export default class VKGroupUpdateHandler {
	logger: Logger;

	constructor(public api: VKApi) {
		this.logger = api.logger;
	}

	async parseAttachment(attachment: any): Promise<Attachment> {
		switch (attachment.type) {
			case 'photo': {
				const sizes = attachment.photo.sizes;
				const maxSize = sizes[sizes.length - 1];
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
					lookupMime(attachment.doc.ext) || 'text/plain',
				);
			}
			case 'audio_message': {
				return Voice.fromUrl('GET', attachment.audio_message.link_ogg, {}, 'voice.ogg', 'audio/ogg', attachment.audio_message.duration * 1000);
			}
			case 'video': {
				// TODO: Extract something useful? Maybe create
				// TODO: VKVideoData extends Data?
				return Video.fromEmpty(attachment.video.title, 'video/mp4');
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
			this.api.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))) as Promise<Attachment[]>,
			this.parseExtraAttachments(message),
		]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this.api,
			user,
			chat: null,
			attachments: [
				...(attachments as Attachment[]),
				...(extraAttachments as Attachment[]),
			] as Attachment[],
			text: message.text || '',
			// Replies have no forwarded messages
			forwarded: [],
			messageId: '0',
			replyTo: null,
		};
	}
	async parseMessage(message: any, parseChat = false): Promise<IMessage> {
		// Do everything in parallel!
		// Typescript fails to analyze dat shit 🤷‍
		const [chat, user, attachments, extraAttachments, forwarded, replyTo] = await Promise.all([
			(parseChat && message.peer_id > 2e9) ? this.api.getApiChat(message.peer_id - 2e9) : null,
			this.api.getApiUser(message.from_id),
			Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
			this.parseExtraAttachments(message),
			(message.fwd_messages ? Promise.all(message.fwd_messages.map((m: any) => this.parseMessage(m))) : Promise.resolve([])),
			message.reply_message ? (this.parseReplyMessage(message.reply_message)) : null,
		] as [Promise<VKChat | null>, Promise<VKUser | null>, Promise<Attachment[]>, Promise<Attachment[]>, Promise<IMessage[]>, Promise<IMessage | null>]);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this.api,
			user: user,
			chat: chat,
			attachments: [
				...(attachments as Attachment[]),
				...(extraAttachments as Attachment[]),
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
						this.api.getApiUser(update.from_id),
						this.api.getApiChat(update.peer_id - 2e9),
					]);
					if (!user) throw new Error(`Bad user: ${update.from_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					const newTitle = update.action.text;
					this.api.bus.emit(new ChatTitleChangeEvent(
						this.api,
						// If old title is in cache
						chat.title === newTitle ? null : chat.title,
						newTitle,
						user,
						chat,
					));
					(chat as Writeable<VKChat>).title = newTitle;
					return;
				}
				case 'chat_invite_user_by_link': {
					const [user, chat] = await Promise.all([
						this.api.getApiUser(update.from_id),
						this.api.getApiChat(update.peer_id - 2e9),
					]);
					if (!user) throw new Error(`Bad user: ${update.from_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					this.api.bus.emit(new JoinChatEvent(
						this.api,
						user,
						null,
						JoinReason.INVITE_LINK,
						null,
						chat,
					));
					if (!chat.users.includes(user))
						chat.users.push(user);
					return;
				}
				case 'chat_invite_user': {
					const [user, chat] = await Promise.all([
						this.api.getApiUser(update.action.member_id),
						this.api.getApiChat(update.peer_id - 2e9),
					]);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					if (update.from_id === update.action.member_id) {
						this.api.bus.emit(new JoinChatEvent(
							this.api,
							user,
							null,
							JoinReason.RETURNED,
							null,
							chat,
						));
					} else {
						this.api.bus.emit(new JoinChatEvent(
							this.api,
							user,
							await this.api.getApiUser(update.from_id),
							JoinReason.INVITED,
							null,
							chat,
						));
					}
					if (!chat.users.includes(user))
						chat.users.push(user);
					return;
				}
				case 'chat_kick_user': {
					const [user, chat] = await Promise.all([
						this.api.getApiUser(update.action.member_id),
						this.api.getApiChat(update.peer_id - 2e9),
					]);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (!chat) throw new Error(`Bad chat: ${update.peer_id}`);
					if (update.from_id === update.action.member_id) {
						this.api.bus.emit(new LeaveChatEvent(
							this.api,
							user,
							null,
							LeaveReason.SELF,
							null,
							chat,
						));
					} else {
						this.api.bus.emit(new LeaveChatEvent(
							this.api,
							user,
							await this.api.getApiUser(update.from_id),
							LeaveReason.KICKED,
							null,
							chat,
						));
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
		if (parsed.text.startsWith('/') && !parsed.text.startsWith('//') && parsed.text.length != 1) {
			this.api.bus.emit(new CommandMessageEvent(parsed, parsed.text.slice(1)));
		} else {
			this.api.bus.emit(new PlainMessageEvent(parsed));
		}
	}
	async processMessageTypingStateUpdate(update: any) {
		// TODO: Distinct event types? (VK always sends "typing")
		if (update.state !== 'typing') throw new Error(`Unknown typing state: ${update.state}`);
		const user = await this.api.getApiUser(update.from_id);
		if (!user) throw new Error(`Bad user: ${update.from_id}`);
		this.api.bus.emit(new TypingEvent(
			this.api,
			user,
			null,
			user,
			TypingEventType.WRITING_TEXT,
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
}
