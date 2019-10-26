import { Api } from "../../model/api";
import VKApiProcessor from "./apiProcessor";
import GroupingVKApiRequester from "./groupingRequester";
import { IMessage } from "../../model/message";
import { emit } from "@meteor-it/xrest";
import { nonenumerable } from 'nonenumerable';
import VKUser from "./user";
import VKChat from "./chat";
import PromiseMap from "../promiseMap";
import VKUserMap from "./userMap";
import VKChatMap from "./chatMap";
import { Attachment, Image, Audio, File, Video, Location, MessengerSpecificUnknownAttachment, Voice } from "../../model/attachment/attachment";
import { lookup as lookupMime } from '@meteor-it/mime';
import { MessageEvent } from '../../model/events/message';
import { JoinChatEvent, JoinReason } from "../../model/events/join";
import { LeaveChatEvent, LeaveReason } from "../../model/events/leave";

export default class VKApi extends Api<VKApi> {
	processor: VKApiProcessor;
	userMap: VKUserMap;
	chatMap: VKChatMap;
	@nonenumerable
	tokens: string[];
	constructor(public apiId: string, public groupId: number, tokens: string[]) {
		super('vk');
		this.processor = new VKApiProcessor(this.logger, tokens);
		this.userMap = new VKUserMap(this);
		this.chatMap = new VKChatMap(this);
		this.tokens = tokens;
	}
	async init() {
	}
	getApiUser(id: number): Promise<VKUser | null> {
		// TODO: Add bot support (negative ids)
		if (id < 0) {
			return Promise.resolve(null);
		}
		return this.userMap.get(id);
	}
	async getApiChat(id: number): Promise<VKChat> {
		if (id >= 2e9) throw new Error('Already transformed id passed');
		return this.chatMap.get(id);
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
		const user = await this.getApiUser(message.from_id);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);
		return {
			api: this,
			user,
			chat: null,
			conversation: user,
			attachments: [
				...await Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
				...await this.parseExtraAttachments(message)
			] as Attachment[],
			text: message.text || '',
			// Replies have no forwarded messages
			forwarded: [],
			messageId: message.id.toString(),
			replyTo: null,
		};
	}
	async parseMessage(message: any, parseChat: boolean = false): Promise<IMessage<VKApi>> {
		let chat = (parseChat && message.peer_id > 2e9) ? await this.getApiChat(message.peer_id - 2e9) : null;
		let user = await this.getApiUser(message.from_id);
		if (!user) throw new Error(`Bad user: ${message.from_id}`);

		return {
			api: this,
			user: user,
			chat: chat,
			conversation: chat || user,
			attachments: [
				...await Promise.all(message.attachments.map((e: any) => this.parseAttachment(e))),
				...await this.parseExtraAttachments(message)
			] as Attachment[],
			text: message.text || '',
			forwarded: message.fwd_messages ? await Promise.all(message.fwd_messages.map((m: any) => this.parseMessage(m))) : [],
			messageId: message.id.toString(),
			replyTo: message.reply_message ? (await this.parseReplyMessage(message.reply_message)) : null,
		};
	}
	async processNewMessageUpdate(update: any) {
		console.log(update);
		if (update.action) {
			switch (update.action.type) {
				case 'chat_invite_user_by_link': {
					const user = await this.getApiUser(update.from_id);
					if (!user) throw new Error(`Bad user: ${update.from_id}`);
					this.joinChatEvent.emit(new JoinChatEvent(
						this,
						user,
						null,
						JoinReason.INVITE_LINK,
						null,
						await this.getApiChat(update.peer_id - 2e9)
					));
					return;
				}
				case 'chat_invite_user': {
					const user = await this.getApiUser(update.action.member_id);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (update.from_id === update.action.member_id) {
						this.joinChatEvent.emit(new JoinChatEvent(
							this,
							user,
							null,
							JoinReason.RETURNED,
							null,
							await this.getApiChat(update.peer_id - 2e9)
						));
					} else {
						this.joinChatEvent.emit(new JoinChatEvent(
							this,
							user,
							await this.getApiUser(update.from_id),
							JoinReason.INVITED,
							null,
							await this.getApiChat(update.peer_id - 2e9)
						));
					}

					return;
				}
				case 'chat_kick_user': {
					const user = await this.getApiUser(update.action.member_id);
					if (!user) throw new Error(`Bad user: ${update.action.member_id}`);
					if (update.from_id === update.action.member_id) {
						this.leaveChatEvent.emit(new LeaveChatEvent(
							this,
							user,
							null,
							LeaveReason.SELF,
							null,
							await this.getApiChat(update.peer_id - 2e9)
						));
					} else {
						this.leaveChatEvent.emit(new LeaveChatEvent(
							this,
							user,
							await this.getApiUser(update.from_id),
							LeaveReason.KICKED,
							null,
							await this.getApiChat(update.peer_id - 2e9)
						))
					}

					return;
				}
				default:
					this.logger.error(`Unknown message action: ${update.action.type}`);
					this.logger.error(update.object);
			}
			return;
		}
		const parsed = await this.parseMessage(update, true);
		this.messageEvent.emit(new MessageEvent(
			this, parsed.user,
			parsed.chat,
			parsed.conversation, parsed.attachments, parsed.text, parsed.forwarded, parsed.messageId, parsed.replyTo
		));
		// console.warn(parsed);

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
				group_id: 180370112
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
}
