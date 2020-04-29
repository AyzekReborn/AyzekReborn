import type { ArgumentType } from "@ayzek/command-parser/arguments";
import type ApiFeature from "@ayzek/model/features";
import type { Text } from '@ayzek/text';
import Logger from "@meteor-it/logger";
import { isPromise, MaybePromise, TypedEvent } from "@meteor-it/utils";
import type { Attachment } from "./attachment";
import type { Chat, Conversation, Guild, User } from "./conversation";
import type { JoinChatEvent, JoinGuildEvent } from "./events/join";
import type { LeaveChatEvent, LeaveGuildEvent } from "./events/leave";
import type { MessageEvent } from './events/message';
import type { ChatTitleChangeEvent, GuildTitleChangeEvent } from "./events/titleChange";
import type { TypingEvent } from "./events/typing";
import type { IMessageOptions } from "./message";

/**
 * Error thrown if feature isn't supported by api
 */
export class NotImplementedInApiError extends Error {
	constructor(method: string, feature?: ApiFeature) {
		super(`Not implemented in api: ${method}${feature ? ` (From feature: ${feature})` : ''}`);
		this.name = 'NotImplementedInApiError';
	}
}

/**
 * Api implements bridges from messenger ifaces to ayzek events
 */
export abstract class Api {
	/**
	 * Api should prefer to use this logger instead of implementing its own
	 */
	logger: Logger;

	messageEvent = new TypedEvent<MessageEvent>();
	typingEvent = new TypedEvent<TypingEvent>();

	joinGuildEvent = new TypedEvent<JoinGuildEvent>();
	joinChatEvent = new TypedEvent<JoinChatEvent>();

	leaveGuildEvent = new TypedEvent<LeaveGuildEvent>();
	leaveChatEvent = new TypedEvent<LeaveChatEvent>();

	guildTitleChangeEvent = new TypedEvent<GuildTitleChangeEvent>();
	chatTitleChangeEvent = new TypedEvent<ChatTitleChangeEvent>();

	constructor(name: string | Logger) {
		this.logger = Logger.from(name);
	}

	/**
	 * Get user by UID
	 */
	getUser(_uid: string): MaybePromise<User | null> {
		return null;
	}

	/**
	 * Get chat by CID
	 */
	getChat(_cid: string): MaybePromise<Chat | null> {
		return null;
	}

	/**
	 * Get either user or chat by UID or CID
	 */
	getConversation(id: string): MaybePromise<Conversation | null> {
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
	getGuild(_gid: string): MaybePromise<Guild | null> {
		return null;
	}

	/**
	 * Sends message to conversation, verifying or transforming attachments/text
	 *
	 * TODO: Return editable message
	 */
	send(_conv: Conversation, _text: Text, _attachments: Attachment[], _options: IMessageOptions): Promise<void> {
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
	 * Since every api have their own mention syntax, this
	 * field holds propper implementation, which then consumed
	 * by userArgument
	 */
	abstract get apiLocalUserArgumentType(): ArgumentType<any, User>;
}
