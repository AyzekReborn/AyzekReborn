import Logger from "@meteor-it/logger";
import { User, Chat, Conversation, Guild } from "./conversation";
import { Text } from './text';
import { Attachment } from "./attachment/attachment";

export class NotImplementedInApiError extends Error {
	constructor(method: string) {
		super(`Not implemented in api: ${method}`);
	}
}

export class Api {
	logger: Logger;

	constructor(name: string | Logger) {
		this.logger = Logger.from(name);
	}
	getUser(uid: string): Promise<User<this>> {
		throw new NotImplementedInApiError('getUser');
	}
	getChat(cid: string): Promise<Chat<this>> {
		throw new NotImplementedInApiError('getChat');
	}
	getGuild(gid: string): Promise<Guild<this>> {
		throw new NotImplementedInApiError('getGuild');
	}
	send(conv: Conversation<this>, text: Text<this>, attachments: Attachment[], options: IMessageOptions): Promise<void> {
		throw new NotImplementedInApiError('send');
	}
}
