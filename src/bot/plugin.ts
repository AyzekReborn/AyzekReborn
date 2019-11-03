import { MessageEventContext } from "./context";
import { literal as defaultLiteral, argument as defaultArgument } from '../command';
import { ArgumentType } from "../command/arguments";
import { LiteralArgumentBuilder } from "../command/builder";

type IMessageListener = {
	name: string,
	description?: string,
	handler: (ctx: MessageEventContext<any>) => Promise<void>,
};
export enum PluginCategory {
	UTILITY,
	FUN,
}
type PluginInfo = {
	category: PluginCategory,
	commands: LiteralArgumentBuilder<MessageEventContext<any>>[],
	listeners: IMessageListener[]
} & {
	name: string;
	author?: string;
	description?: string;

	init?(): Promise<void>
	deinit?(): Promise<void>
};
export { PluginInfo };
export function literal(name: string) {
	return defaultLiteral<MessageEventContext<any>>(name);
}
export function argument<T>(name: string, type: ArgumentType<T>) {
	return defaultArgument<MessageEventContext<any>, T>(name, type);
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
