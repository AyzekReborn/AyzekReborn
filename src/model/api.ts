import Logger from "@meteor-it/logger";
import ApiFeature from "../api/features";
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
	getUser(_uid: string): Promise<User<A> | null> {
		return Promise.resolve(null);
	}

	/**
	 * Get chat by CID
	 */
	getChat(_cid: string): Promise<Chat<A> | null> {
		return Promise.resolve(null);
	}

	/**
	 * Get either user or chat by UID or CID
	 */
	async getConversation(id: string): Promise<Conversation<A> | null> {
		return (await Promise.all([this.getUser(id), this.getChat(id)])).filter(e => e !== null)[0] || null;
	}

	/**
	 * Get guild by GID
	 */
	getGuild(_gid: string): Promise<Guild<A> | null> {
		return Promise.resolve(null);
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
