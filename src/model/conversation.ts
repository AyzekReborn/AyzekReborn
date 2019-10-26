import { Api } from "./api";
import { Attachment, Image } from "./attachment/attachment";
import { LinePart, MentionLinePart, ChatReferenceLinePart } from "./text";
import { IMessageOptions } from "./message";
import { nonenumerable } from 'nonenumerable';

enum ConversationType {
	USER,
	CHAT,
	OTHER
}

export abstract class Conversation<A extends Api<A>> {
	@nonenumerable
	readonly api: A
	constructor(
		api: A,
		public readonly targetId: string,
		public readonly conversationType: ConversationType,
	) {
		this.api = api;
	}

	async send(text: string, attachments: Attachment[] = [], options: IMessageOptions = {}) {
		return await this.api.send(this, text, attachments, options);
	}

	get isUser() {
		return this.conversationType === ConversationType.USER;
	}
	get isChat() {
		return this.conversationType === ConversationType.CHAT;
	}

	abstract get reference(): LinePart<A>;
}


export enum Gender {
	MAN,
	WOMAN,
	OTHER,
	ANDROGYNOUS,
	BOT,
};

export enum UserType {
	NORMAL,
	BOT,
}

export abstract class User<A extends Api<A>> extends Conversation<A> {
	constructor(
		api: A,
		targetId: string,
		public readonly uid: string,
		public readonly nickName: string | null,
		public readonly firstName: string | null,
		public readonly lastName: string | null,
		public readonly gender: Gender,
		public readonly profileUrl: string,
		public readonly isBot: boolean,
	) {
		super(api, targetId, ConversationType.USER);
	}
	abstract get photoImage(): Promise<Image | null>;

	private get idName() {
		return `<Unknown ${this.uid}>`;
	}
	get name(): string {
		if (this.nickName)
			return this.nickName;
		else if (this.firstName)
			return this.firstName;
		else return this.idName;
	}
	get fullName(): string {
		let name = '';
		if (this.firstName)
			name += this.firstName + ' ';
		if (this.lastName)
			name += this.lastName + ' ';
		if (this.nickName)
			name += `(${this.nickName}) `;
		name = name.trim();
		if (name === '') {
			return this.idName;
		}
		return name;
	}

	get reference(): LinePart<A> {
		return {
			type: 'mentionPart',
			data: this,
		} as MentionLinePart<A>
	}
}

export abstract class Guild<A extends Api<A>> {
	constructor(
		public readonly api: A,
		public readonly gid: string,
	) { };
};

export abstract class Chat<A extends Api<A>> extends Conversation<A> {
	constructor(
		api: A,
		targetId: string,
		public readonly cid: string,
		public readonly users: User<A>[],
		public readonly title: string,
		public readonly admins: User<A>[],
		public readonly guild: Guild<A> | null,
	) {
		super(api, targetId, ConversationType.CHAT);
	}

	abstract get photoImage(): Promise<Image | null>;

	get reference(): LinePart<A> {
		return {
			type: 'chatRefPart',
			data: this,
		} as ChatReferenceLinePart<A>
	}
}
