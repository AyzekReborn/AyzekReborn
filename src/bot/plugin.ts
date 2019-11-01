import { MessageEventContext } from "./context";
import { literal as defaultLiteral, argument as defaultArgument } from '../command';
import { ArgumentType } from "../command/arguments";
import { LiteralArgumentBuilder } from "../command/builder";
import { IPlugin } from "@meteor-it/plugin-loader";

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
} & IPlugin;
export { PluginInfo };
export function literal(name: string) {
	return defaultLiteral<MessageEventContext<any>>(name);
}
export function argument<T>(name: string, type: ArgumentType<T>) {
	return defaultArgument<MessageEventContext<any>, T>(name, type);
}

export function listener(handler: (ctx: MessageEventContext<any>) => Promise<void>): IMessageListener {
	return { handler };
}

export function regexpListener(regexp: RegExp, handler: (ctx: MessageEventContext<any>, args: string[]) => Promise<void>): IMessageListener {
	return {
		handler(ctx: MessageEventContext<any>) {
			const match = ctx.event.text.match(regexp);
			if (match === null)
				return Promise.resolve();
			return handler(ctx, match);
		}
	}
}
