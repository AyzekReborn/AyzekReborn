import type { Api } from '@ayzek/model/api';
import type { Attachment } from '@ayzek/model/attachment';
import type { Chat, Conversation, IConversation, User } from '@ayzek/model/conversation';
import type { MessageEvent } from '@ayzek/model/events/message';
import type { IMessage, IMessageOptions } from '@ayzek/model/message';
import type { Text } from '@ayzek/text';
import type { Ayzek } from './ayzek';

export class ContextAttachment {

}
export class MissingAttachmentError extends Error {
	constructor(attachment: ContextAttachmentConstructor<any>) {
		super(`Missing attachment required in context: ${attachment.name}`);
		this.name = 'MissingAttachmentError';
	}
}
type ContextAttachmentConstructor<T extends ContextAttachment> = new () => T;
export class MessageContext<E> {
	constructor(public event: E) { }
	private attachments: Map<ContextAttachmentConstructor<any>, ContextAttachment> = new Map();
	attachment<T>(type: ContextAttachmentConstructor<T>): T {
		if (!this.attachments.has(type))
			throw new MissingAttachmentError(type);
		return this.attachments.get(type)! as T;
	}
	nullableAttachment<T>(type: ContextAttachmentConstructor<T>): T | null {
		return this.attachments.get(type) as T || null;
	}
}

export class MessageEventContext extends MessageContext<MessageEvent> implements IConversation {
	constructor(public ayzek: Ayzek, public event: MessageEvent) {
		super(event);
	}
	get api(): Api {
		return this.event.api;
	}
	get user(): User {
		return this.event.user;
	}
	get chat(): Chat | null {
		return this.event.chat;
	}
	get conversation(): Conversation {
		return this.event.conversation;
	}

	send(text: Text, attachments?: Attachment[], options?: IMessageOptions): Promise<void> {
		return this.event.conversation.send(text, attachments, options);
	}
	waitForNext(shouldAccept: (message: IMessage) => boolean, timeout: number | null): Promise<IMessage> {
		return this.event.conversation.waitForNext(shouldAccept, timeout);
	}
}

export class CommandEventContext extends MessageEventContext {
	constructor(ayzek: Ayzek, event: MessageEvent, public command: string, public commandPrefix: string | null) {
		super(ayzek, event);
	}

	get isPayloadIssued() {
		return this.commandPrefix === null;
	}
}
