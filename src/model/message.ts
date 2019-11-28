import { Api } from "./api"
import { Attachment } from "./attachment/attachment"
import { Chat, Conversation, User } from "./conversation"

export type ForwardInfo = {
	messageId: string,
}

export type IMessage<A extends Api<A>> = {
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
	replyTo?: ForwardInfo,
	forwarded?: ForwardInfo[],
}
