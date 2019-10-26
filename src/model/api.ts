import Logger from "@meteor-it/logger";
import { User, Chat, Conversation, Guild } from "./conversation";
import { Text } from './text';
import { Attachment } from "./attachment/attachment";
import { IMessageOptions } from "./message";
import { MessageEvent } from './events/message';
import { JoinChatEvent, JoinGuildEvent } from "./events/join";
import { LeaveGuildEvent, LeaveChatEvent } from "./events/leave";
import { GuildTitleChangeEvent, ChatTitleChangeEvent } from "./events/titleChange";
import { TypedEvent } from "../util/event";

export class NotImplementedInApiError extends Error {
	constructor(method: string) {
		super(`Not implemented in api: ${method}`);
	}
}

export abstract class Api<A extends Api<A>> {
	logger: Logger;

	messageEvent: TypedEvent<MessageEvent<A>> = new TypedEvent();

	joinGuildEvent = new TypedEvent<JoinGuildEvent<A>>();
	joinChatEvent = new TypedEvent<JoinChatEvent<A>>();

	leaveGuildEvent = new TypedEvent<LeaveGuildEvent<A>>();
	leaveChatEvent = new TypedEvent<LeaveChatEvent<A>>();

	guildTitleChangeEvent = new TypedEvent<GuildTitleChangeEvent<A>>();
	chatTitleChangeEvent = new TypedEvent<ChatTitleChangeEvent<A>>();

	constructor(name: string | Logger) {
		this.logger = Logger.from(name);
	}
	getUser(uid: string): Promise<User<A>> {
		throw new NotImplementedInApiError('getUser');
	}
	getChat(cid: string): Promise<Chat<A>> {
		throw new NotImplementedInApiError('getChat');
	}
	getGuild(gid: string): Promise<Guild<A>> {
		throw new NotImplementedInApiError('getGuild');
	}
	send(conv: Conversation<A>, text: Text<A>, attachments: Attachment[], options: IMessageOptions): Promise<void> {
		throw new NotImplementedInApiError('send');
	}

	// emit(name: 'message', event: MessageEvent<this>): boolean;

	// emit(name: 'joinGuild', event: JoinGuildEvent<this>): boolean;
	// emit(name: 'joinChat', event: JoinChatEvent<this>): boolean;

	// emit(name: 'leaveGuild', event: LeaveGuildEvent<this>): boolean;
	// emit(name: 'leaveChat', event: LeaveChatEvent<this>): boolean;

	// emit(name: 'guildTitleChange', event: GuildTitleChangeEvent<this>): boolean;
	// emit(name: 'chatTitleChange', event: ChatTitleChangeEvent<this>): boolean;
}
