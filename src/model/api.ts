import Logger from "@meteor-it/logger";
import ApiFeature from "../api/features";
import { isPromise, MaybePromise } from "../api/promiseMap";
import { ArgumentType } from "../command/arguments";
import { TypedEvent } from "../util/event";
import { Attachment } from "./attachment/attachment";
import { Chat, Conversation, Guild, User } from "./conversation";
import { JoinChatEvent, JoinGuildEvent } from "./events/join";
import { LeaveChatEvent, LeaveGuildEvent } from "./events/leave";
import { MessageEvent } from './events/message';
import { ChatTitleChangeEvent, GuildTitleChangeEvent } from "./events/titleChange";
import { TypingEvent } from "./events/typing";
import { IMessageOptions } from "./message";
import { Text } from './text';

export class NotImplementedInApiError extends Error {
	constructor(method: string) {
		super(`Not implemented in api: ${method}`);
		this.name = 'NotImplementedInApiError';
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

	/**
	 * Get user by UID
	 */
	getUser(_uid: string): MaybePromise<User<A> | null> {
		return null;
	}

	/**
	 * Get chat by CID
	 */
	getChat(_cid: string): MaybePromise<Chat<A> | null> {
		return null;
	}

	/**
	 * Get either user or chat by UID or CID
	 */
	getConversation(id: string): MaybePromise<Conversation<A> | null> {
		const user = this.getUser(id);
		if (!isPromise(user)) return user;
		if (user === null) return null;
		const chat = this.getChat(id);
		if (!isPromise(chat)) return chat;
		if (chat === null) return null;
		return Promise.all([this.getUser(id), this.getChat(id)]).then(v => v[0] ?? v[1] ?? null);
	}

	/**
	 * Get guild by GID
	 */
	getGuild(_gid: string): MaybePromise<Guild<A> | null> {
		return null;
	}

	/**
	 * Sends message to conversation, verifying or transforming attachments/text
	 *
	 * TODO: Return editable message
	 */
	send(_conv: Conversation<A>, _text: Text<A>, _attachments: Attachment[], _options: IMessageOptions): Promise<void> {
		throw new NotImplementedInApiError('send');
	}

	/**
	 * Contains every feature this api can do
	 */
	protected abstract supportedFeatures: Set<ApiFeature>;

	/**
	 * Check if api can use/mimic passed feature
	 */
	isFeatureSupported(feature: ApiFeature) {
		return this.supportedFeatures.has(feature);
	}

	/**
	 * Starts event loop/connects to server
	 *
	 * TODO: Cancellable
	 */
	public abstract async doWork(): Promise<void>;

	/**
	 * Since every api have thier own mention syntax, this
	 * field holds propper implementation, which then consumed
	 * by userArgument
	 */
	abstract get apiLocalUserArgumentType(): ArgumentType<User<A>>;
}
