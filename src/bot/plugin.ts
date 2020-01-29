import { LiteralArgumentBuilder } from "../command/builder";
import { Chat, Conversation, User } from "../model/conversation";
import { AttachmentCreator } from "./attachment/attachment";
import { Ayzek } from "./ayzek";
import { MessageEventContext, CommandEventContext } from "./context";
import { CommandContext, CurrentArguments } from "../command/command";
import { Requirement } from "../command/requirement";
import { Text } from "../model/text";

/**
 * TODO: Message requirements
 */
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
	commands: LiteralArgumentBuilder<AyzekCommandSource, any>[],
	listeners: IMessageListener[],
	userAttachments?: AttachmentCreator<User<any>, any>[],
	chatAttachments?: AttachmentCreator<Chat<any>, any>[],
	conversationAttachments?: AttachmentCreator<Conversation<any>, any>[],

	ayzekAttachments?: AttachmentCreator<Ayzek<any>, any>[],
} & {
	/**
	 * Class name by default
	 */
	name: string;
	/**
	 * Plugin developer, displayed in /help from MainPlugin
	 */
	author?: string;
	/**
	 * Plugin description, displayed in /help
	 */
	description?: string;

	/**
	 * Called on init
	 */
	init?(): Promise<void>;
	/**
	 * Called on deinit
	 */
	deinit?(): Promise<void>;
	/**
	 * To display addictional info in /help
	 */
	getHelpAddictionalInfo?(ctx: AyzekCommandContext): Text<any>;
};
export { PluginInfo };

/**
 * @param names primary name or name with aliases.
 * Description is added in .executes() method of builder
 * @returns builder to add into PluginInfo#commands
 */
export function command(names: string | string[]) {
	return new LiteralArgumentBuilder<CommandEventContext<any>, {}>((typeof names === 'string' ? [names] : names));
}

/**
 * Simple message listener, receives all messages
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param handler message handler
 * @returns listener to add info PluginInfo#listeners
 */
export function listener(name: string, description: string, handler: (ctx: MessageEventContext<any>) => Promise<void>): IMessageListener {
	return { name, description, handler };
}

/**
 * Supplies only matched messages, with capture group as args argument
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param regexp expression with capture groups
 * @param handler message handler
 */
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

export type AyzekCommandSource = CommandEventContext<any>;
export type AyzekCommandContext<O extends CurrentArguments = {}> = CommandContext<AyzekCommandSource, O>;
export type AyzekCommandRequirement = Requirement<AyzekCommandSource>;

/**
 * Command can be only executed by payload (Prefer PluginInfo#payloadHandlers instead)
 * FIXME: Recomendation is not available because payloadHandlers not implemented
 */
export function requireHidden(): AyzekCommandRequirement {
	return source => source.isPayloadIssued;
}

/**
 * Command is only exists in development env
 * I.e unsafe debugging helpers
 */
export function requireDevelopment(): AyzekCommandRequirement {
	return _source => process.env.NODE_ENV === 'DEVELOPMENT';
}
