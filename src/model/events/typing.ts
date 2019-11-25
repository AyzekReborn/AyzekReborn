import { Api } from "../api";
import { User, Conversation, Chat } from "../conversation";
import StringReader from "../../command/reader";

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
export class TypingEvent<A extends Api<A>> {
	constructor(
		public api: A,
		public user: User<A>,
		public chat: Chat<A> | null,
		public conversation: Conversation<A>,
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
