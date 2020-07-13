import type { AttributeCreator } from '@ayzek/attribute';
import { LiteralArgumentBuilder } from '@ayzek/command-parser/builder';
import type { Text } from '@ayzek/text';
import * as t from 'io-ts';
import type { Ayzek } from './ayzek';
import { AyzekCommandContext, AyzekCommandSource } from './command';
import { Chat, Conversation, User } from './conversation';
import { CustomEventConstructor } from './events/custom';
import { PlainMessageEvent } from './events/message';

export type IListener<S> = {
	name: string,
	description: string,

	type: CustomEventConstructor<S>,
	handler: (event: S) => void,
}

export enum PluginCategory {
	API,
	UTILITY,
	FUN,
}

type PluginInfo = {
	// Injected by ModernPluginSystem
	ayzek?: Ayzek,

	category: PluginCategory,
	commands?: LiteralArgumentBuilder<AyzekCommandSource, any, Text>[],

	listeners?: IListener<any>[],

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
	config: t.TypeOf<P>;
	configType: P;
	defaultConfig: t.TypeOf<P>;
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
	// There {} literally means "empty object"
	// eslint-disable-next-line @typescript-eslint/ban-types
	return new LiteralArgumentBuilder<AyzekCommandSource, {}, Text>((typeof names === 'string' ? [names] : names));
}

/**
 * Simple message listener, receives all messages
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param handler message handler
 * @returns listener to add info PluginInfo#listeners
 */
export function plainMessageListener(name: string, description: string, handler: (ctx: PlainMessageEvent) => Promise<void>): IListener<PlainMessageEvent> {
	// return { name, description, handler };
	return {
		name,
		description,
		type: PlainMessageEvent,
		async handler(event) {
			return await handler(event);
		},
	};
}

/**
 * Supplies only matched messages, with capture group as args argument
 * @param name listener name, not unique, displayed in /help
 * @param description description, displayed in /help
 * @param regexp expression with capture groups
 * @param handler message handler
 */
export function regexpMessageListener(name: string, description: string, regexp: RegExp, handler: (ctx: PlainMessageEvent, args: string[]) => Promise<void>): IListener<PlainMessageEvent> {
	return plainMessageListener(name, description, ctx => {
		const match = ctx.text.match(regexp);
		if (match === null)
			return Promise.resolve();
		return handler(ctx, match);
	});
}
