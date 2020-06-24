import type { Api } from '../api';
import type { Attachment } from '../attachment';
import type { Chat, Conversation, User } from '../conversation';
import type { IMessage } from '../message';

/**
 * Received message event
 */
export class MessageEvent implements IMessage {
	constructor(
		public api: Api,
		public user: User,
		public chat: Chat | null,
		public conversation: Conversation,
		public attachments: Attachment[],
		public text: string,
		/**
		 * Forwarded messages, sorted ascending by time
		 */
		public forwarded: IMessage[],
		/**
		 * Messenger specific message id
		 */
		public messageId: string,
		public replyTo: IMessage | null,

		/**
		 * WIP: Keyboards/another shit
		 */
		public payload?: string,
	) { }

	/**
	 * Return reply if available, and last forwarded otherwise
	 */
	get maybeForwarded(): IMessage | null {
		if (this.replyTo) return this.replyTo;
		if (this.forwarded.length >= 1) return this.forwarded[this.forwarded.length - 1];
		return null;
	}
}
