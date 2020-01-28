import { Api } from "../model/api";
import { Attachment } from "../model/attachment/attachment";
import { IConversation, Chat, Conversation, User } from "../model/conversation";
import { MessageEvent } from "../model/events/message";
import { IMessage, IMessageOptions } from "../model/message";
import { Text } from '../model/text';
import { Ayzek } from "./ayzek";

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

export class MessageEventContext<A extends Api<A>> extends MessageContext<MessageEvent<A>> implements IConversation<A> {
	constructor(public ayzek: Ayzek<A>, public event: MessageEvent<A>) {
		super(event);
	}
	get api(): A {
		return this.event.api;
	}
	get user(): User<A> {
		return this.event.user;
	}
	get chat(): Chat<A> | null {
		return this.event.chat;
	}
	get conversation(): Conversation<A> {
		return this.event.conversation;
	}

	send(text: Text<A>, attachments?: Attachment[], options?: IMessageOptions): Promise<void> {
		return this.event.conversation.send(text, attachments, options);
	}
	waitForNext(shouldAccept: (message: IMessage<A>) => boolean, timeout: number | null): Promise<IMessage<A>> {
		return this.event.conversation.waitForNext(shouldAccept, timeout);
	}
}

export class CommandEventContext<A extends Api<A>> extends MessageEventContext<A> {
	constructor(ayzek: Ayzek<A>, event: MessageEvent<A>, public command: string, public commandPrefix: string | null) {
		super(ayzek, event);
	}

	get isPayloadIssued() {
		return this.commandPrefix === null;
	}
}
