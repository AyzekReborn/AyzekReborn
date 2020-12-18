import { Translation } from '@ayzek/text';
import type { Api } from './api';
import type { Chat, User } from './conversation';
import { Attachment } from './model/attachment';

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
	locale?: Translation,
}
