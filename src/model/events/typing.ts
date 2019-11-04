import { Api } from "../api";
import { User, Conversation, Chat } from "../conversation";

export enum TypingEventType {
	RECORDING_VOICE_MESSAGE,
	WRITING_TEXT,
	SENDING_PHOTO,
}

export class TypingEvent<A extends Api<A>> {
	constructor(
		public api: A,
		public user: User<A>,
		public chat: Chat<A> | null,
		public conversation: Conversation<A>,
		public typingType: TypingEventType,
	) { }
}
