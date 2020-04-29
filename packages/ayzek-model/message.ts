import type { Api } from "./api"
import type { Attachment } from "./attachment"
import type { Chat, Conversation, User } from "./conversation"

export type ForwardInfo = {
	messageId: string,
}

export type IMessage = {
	api: Api,
	user: User,
	chat: Chat | null,
	conversation: Conversation,
	attachments: Attachment[],
	text: string,
	replyTo: IMessage | null,
	forwarded: IMessage[],
	messageId: string,
}

export type IMessageOptions = {
	replyTo?: ForwardInfo,
	forwarded?: ForwardInfo[],
}
