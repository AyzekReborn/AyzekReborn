import type StringReader from "@ayzek/command-parser/reader";
import type { Api } from "../api";
import type { Chat, Conversation, User } from "../conversation";

export enum TypingEventType {
	/**
	 * User requested tab completion
	 */
	TAB_COMPLETION,
	/**
	 * User in progress of recording voice message
	 */
	RECORDING_VOICE_MESSAGE,
	/**
	 * User typing text
	 */
	WRITING_TEXT,
	/**
	 * User is uploading photo
	 */
	SENDING_PHOTO,
}

/**
 * Message writing progress notification
 *
 * TODO: RECORDING_VOICE_MESSAGE+SENDING_PHOTO => Uploading attachment, attachmentType field
 */
export class TypingEvent {
	constructor(
		public api: Api,
		public user: User,
		public chat: Chat | null,
		public conversation: Conversation,
		/**
		 * Action type
		 */
		public typingType: TypingEventType,
		/**
		 * If available - current typed message with cursor position
		 */
		public buffer?: StringReader
	) { }
}
