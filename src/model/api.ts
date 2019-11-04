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
import ApiFeature from "../api/features";
import { TypingEvent } from "./events/typing";

export class NotImplementedInApiError extends Error {
	constructor(method: string) {
		super(`Not implemented in api: ${method}`);
	}
}

export abstract class Api<A extends Api<A>> {
	logger: Logger;

	messageEvent = new TypedEvent<MessageEvent<A>>();
	typingEvent = new TypedEvent<TypingEvent<A>>();

	joinGuildEvent = new TypedEvent<JoinGuildEvent<A>>();
	joinChatEvent = new TypedEvent<JoinChatEvent<A>>();

	leaveGuildEvent = new TypedEvent<LeaveGuildEvent<A>>();
	leaveChatEvent = new TypedEvent<LeaveChatEvent<A>>();

	guildTitleChangeEvent = new TypedEvent<GuildTitleChangeEvent<A>>();
	chatTitleChangeEvent = new TypedEvent<ChatTitleChangeEvent<A>>();

	constructor(name: string | Logger) {
		this.logger = Logger.from(name);
	}
	getUser(_uid: string): Promise<User<A> | null> {
		return Promise.resolve(null);
	}
	getChat(_cid: string): Promise<Chat<A> | null> {
		return Promise.resolve(null);
	}
	getGuild(_gid: string): Promise<Guild<A> | null> {
		return Promise.resolve(null);
	}
	send(conv: Conversation<A>, text: Text<A>, attachments: Attachment[], options: IMessageOptions): Promise<void> {
		throw new NotImplementedInApiError('send');
	}

	protected abstract supportedFeatures: Set<ApiFeature>;

	isFeatureSupported(feature: ApiFeature) {
		return this.supportedFeatures.has(feature);
	}

	public abstract async doWork(): Promise<void>;
}
