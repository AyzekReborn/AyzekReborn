import { IMessage } from "../message";
import { Attachment } from "../attachment/attachment";
import { User, Chat, Conversation } from "../conversation";
import { Api } from "../api";

export class MessageEvent<A extends Api> implements IMessage<A> {
	constructor(
		public api: A,
		public user: User<A>,
		public chat: Chat<A> | null,
		public conversation: Conversation<A>,
		public attachments: Attachment[],
		public text: string,
		public forwarded: IMessage<A>[],
		public messageId: string,
	) { }
}
