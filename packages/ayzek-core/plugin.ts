import type { AttributeCreator } from "@ayzek/attribute";
import { LiteralArgumentBuilder } from "@ayzek/command-parser/builder";
import type { Chat, Conversation, User } from "@ayzek/model/conversation";
import type { Text } from "@ayzek/text";
import type { Ayzek } from "./ayzek";
import { AyzekCommandContext, AyzekCommandSource } from "./command";
import type { MessageEventContext } from "./context";
import * as t from 'io-ts';

/**
 * TODO: Message requirements
 */
export type IMessageListener = {
	name: string,
	description?: string,
	handler: (ctx: MessageEventContext) => Promise<void>,
};

export enum PluginCategory {
	UTILITY,
	FUN,
}

type PluginInfo = {
	// Injected by ModernPluginSystem
	ayzek?: Ayzek,

	category: PluginCategory,
	commands: LiteralArgumentBuilder<AyzekCommandSource, any, Text>[],
	listeners: IMessageListener[],
	userAttributes?: AttributeCreator<User, any>[],
	chatAttributes?: AttributeCreator<Chat, any>[],
	conversationAttributes?: AttributeCreator<Conversation, any>[],

	ayzekAttributes?: AttributeCreator<Ayzek, any>[],
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
	 * To display additional info in /help
	 */
	getHelpAdditionalInfo?(ctx: AyzekCommandContext): Text;
};

type Configurable<P extends t.TypeC<any>> = {
	config?: t.TypeOf<P>;
	configType: P
};

function isConfigurable(t: any): t is Configurable<any> {
	return t.configType !== undefined;
}

export { PluginInfo, Configurable };
export { isConfigurable };

/**
 * @param names primary name or name with aliases.
 * Description is added in .executes() method of builder
 * @returns builder to add into PluginInfo#commands
 */
export function command(names: string | string[]) {
	return new LiteralArgumentBuilder<AyzekCommandSource, {}, Text>((typeof names === 'string' ? [names] : names));
}

/**
 * Simple message listener, receives all messages
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param handler message handler
 * @returns listener to add info PluginInfo#listeners
 */
export function listener(name: string, description: string, handler: (ctx: MessageEventContext) => Promise<void>): IMessageListener {
	return { name, description, handler };
}

/**
 * Supplies only matched messages, with capture group as args argument
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param regexp expression with capture groups
 * @param handler message handler
 */
export function regexpListener(name: string, description: string, regexp: RegExp, handler: (ctx: MessageEventContext, args: string[]) => Promise<void>): IMessageListener {
	return {
		name,
		description,
		handler(ctx: MessageEventContext) {
			const match = ctx.event.text.match(regexp);
			if (match === null)
				return Promise.resolve();
			return handler(ctx, match);
		}
	}
}
