import { Api } from "./api"
import { User, Chat, Conversation } from "./conversation"
import { Attachment } from "./attachment/attachment"

export type IMessage<A extends Api> = {
	api: A,
	user: User<A>,
	chat: Chat<A> | null,
	conversation: Conversation<A>,
	attachments: Attachment[],
	text: string,
	replyTo: IMessage<A> | null,
	forwarded: IMessage<A>[],
	messageId: string,
}

export type IMessageOptions = {
	answerTo?: string,
}
