import { Text, Translation } from '@ayzek/text';
import { Ayzek } from '../ayzek';
import type { IMessage, IMessageOptions } from '../message';
import { Attachment } from '../model/attachment';
import { EVENT_ID } from './custom';

/**
 * Received message event
 */
export abstract class MessageEvent implements IMessage {
	ayzek?: Ayzek;
	constructor(
		public message: IMessage,
	) { }
	get api() { return this.message.api; }
	get user() { return this.message.user; }
	get chat() { return this.message.chat; }
	// If message is sent in chat - chat is returned, user otherwise
	get conversation() { return this.chat || this.user; }
	get attachments() { return this.message.attachments; }
	get text() { return this.message.text; }
	get replyTo() { return this.message.replyTo; }
	get forwarded() { return this.message.forwarded; }
	get messageId() { return this.message.messageId; }
	get payload() { return this.message.payload; }

	/**
	 * Return reply if available, and last forwarded otherwise
	 */
	get maybeForwarded(): IMessage | null {
		if (this.replyTo) return this.replyTo;
		if (this.forwarded.length >= 1) return this.forwarded[this.forwarded.length - 1];
		return null;
	}

	send(text: Text, attachments?: Attachment[], options: IMessageOptions = {}): Promise<void> {
		if (!options.locale) {
			options.locale = new Translation(
				this.chat?.locale._language
				?? this.user.locale._language
				?? this.api.defaultTranslation.language,

				this.chat?.locale._locale ?? this.chat?.locale._language?.defaultLocale
				?? this.user.locale._locale ?? this.user.locale._language?.defaultLocale
				?? this.api.defaultTranslation._locale ?? this.api.defaultTranslation.language.defaultLocale,
			);
		}
		return this.conversation.send(text, attachments, options);
	}
	waitForNext(shouldAccept: (message: IMessage) => boolean, timeout: number | null): Promise<IMessage> {
		return this.conversation.waitForNext(shouldAccept, timeout);
	}
}

export class PlainMessageEvent extends MessageEvent {
	static [EVENT_ID] = 'ayzek:plain';
}
export class CommandMessageEvent extends MessageEvent {
	static [EVENT_ID] = 'ayzek:command';
	constructor(message: IMessage, public command: string) {
		super(message);
	}
	get isPayloadIssued() {
		// TODO
		return false;
	}
}
