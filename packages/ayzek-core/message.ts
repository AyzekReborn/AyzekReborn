import type { Api } from './api';
import type { Attachment } from './attachment';
import type { Chat, User } from './conversation';

export type ForwardInfo = {
	messageId: string,
}

export type IMessage = {
	api: Api,
	user: User,
	chat: Chat | null,
	attachments: Attachment[],
	text: string,
	replyTo: IMessage | null,
	forwarded: IMessage[],
	messageId: string,
	payload?: string,
}

export type IMessageOptions = {
	replyTo?: ForwardInfo,
	forwarded?: ForwardInfo[],
}
