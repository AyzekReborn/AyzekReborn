import type { Api } from "../api";
import type { Attachment } from "../attachment";
import type { Chat, Conversation, User } from "../conversation";
import type { IMessage } from "../message";

/**
 * Received message event
 */
export class MessageEvent<A extends Api<A>> implements IMessage<A> {
	constructor(
		public api: A,
		public user: User<A>,
		public chat: Chat<A> | null,
		public conversation: Conversation<A>,
		public attachments: Attachment[],
		public text: string,
		/**
		 * Forwarded messages, sorted ascending by time
		 */
		public forwarded: IMessage<A>[],
		/**
		 * Messenger specific message id
		 */
		public messageId: string,
		public replyTo: IMessage<A> | null,

		/**
		 * WIP: Keyboards/another shit
		 */
		public payload?: string,
	) { }

	/**
	 * Return reply if available, and last forwarded otherwise
	 */
	get maybeForwarded(): IMessage<A> | null {
		if (this.replyTo) return this.replyTo;
		if (this.forwarded.length >= 1) return this.forwarded[this.forwarded.length - 1];
		return null;
	}
}
