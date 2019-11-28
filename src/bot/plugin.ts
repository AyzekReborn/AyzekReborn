import { LiteralArgumentBuilder } from "../command/builder";
import { Chat, Conversation, User } from "../model/conversation";
import { AttachmentCreator } from "./attachment/attachment";
import { Ayzek } from "./ayzek";
import { MessageEventContext } from "./context";

export type IMessageListener = {
	name: string,
	description?: string,
	handler: (ctx: MessageEventContext<any>) => Promise<void>,
};
export enum PluginCategory {
	UTILITY,
	FUN,
}
type PluginInfo = {
	// Injected by ModernPluginSystem
	ayzek?: Ayzek<any>,

	category: PluginCategory,
	commands: LiteralArgumentBuilder<MessageEventContext<any>, any>[],
	listeners: IMessageListener[],
	userAttachments?: AttachmentCreator<User<any>, any>[],
	chatAttachments?: AttachmentCreator<Chat<any>, any>[],
	conversationAttachments?: AttachmentCreator<Conversation<any>, any>[],

	ayzekAttachments?: AttachmentCreator<Ayzek<any>, any>[],
} & {
	name: string;
	author?: string;
	description?: string;

	init?(): Promise<void>
	deinit?(): Promise<void>
};
export { PluginInfo };

export function command(names: string | string[]) {
	return new LiteralArgumentBuilder<MessageEventContext<any>, {}>((typeof names === 'string' ? [names] : names));
}

export function listener(name: string, description: string, handler: (ctx: MessageEventContext<any>) => Promise<void>): IMessageListener {
	return { name, description, handler };
}

export function regexpListener(name: string, description: string, regexp: RegExp, handler: (ctx: MessageEventContext<any>, args: string[]) => Promise<void>): IMessageListener {
	return {
		name,
		description,
		handler(ctx: MessageEventContext<any>) {
			const match = ctx.event.text.match(regexp);
			if (match === null)
				return Promise.resolve();
			return handler(ctx, match);
		}
	}
}
