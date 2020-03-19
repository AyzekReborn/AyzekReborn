import { ArgumentType } from "@ayzek/command-parser/arguments";
import { UserDisplayableError } from "@ayzek/command-parser/error";
import type StringReader from "@ayzek/command-parser/reader";
import type { Suggestions, SuggestionsBuilder } from "@ayzek/command-parser/suggestions";
import type { Api } from "../model/api";
import type { User } from "../model/conversation";
import type { Ayzek } from "./ayzek";
import type { AyzekCommandContext, AyzekParseEntryPoint } from "./plugin";

export type ParsedUserArgument = [Api<any>, any, Ayzek<any>];

// TODO: Type safety?
export class UserArgumentType extends ArgumentType<ParsedUserArgument, User<any>> {
	parse<P>(ctx: AyzekParseEntryPoint, reader: StringReader): ParsedUserArgument {
		if (!ctx.source.api?.apiLocalUserArgumentType) throw new Error(`source is not ayzek one (${ctx.source})`);
		const user = ctx.source.api.apiLocalUserArgumentType.parse(ctx, reader);
		return [ctx.source.api, user, ctx.source.ayzek];
	}
	async load(parsed: ParsedUserArgument): Promise<User<any>> {
		const user = await parsed[0].apiLocalUserArgumentType.load(parsed[1]);
		await parsed[2].attachToUser(user);
		return user;
	}
	getExamples(ctx: AyzekParseEntryPoint) {
		if (!(ctx.source.api as unknown as Api<any>)?.apiLocalUserArgumentType) throw new Error(`source is not ayzek one (${ctx.source})`);
		return ctx.source.api.apiLocalUserArgumentType.getExamples(ctx);
	}
	async listSuggestions(entry: AyzekParseEntryPoint, ctx: AyzekCommandContext, builder: SuggestionsBuilder): Promise<Suggestions> {
		if (!(ctx.source?.api as unknown as Api<any>)?.apiLocalUserArgumentType) throw new Error(`sourceProvider is not ayzek one (${ctx.source})`);
		const api = ctx.source.api as Api<any>;
		return api.apiLocalUserArgumentType.listSuggestions(entry, ctx, builder);
	}
}

export class NoSuchUserError extends UserDisplayableError {
	constructor(id: string, reader: StringReader) {
		super(`User not found: ${id}`, reader);
		this.name = 'NoSuchUserError';
	}
}

export function userArgument() {
	return new UserArgumentType();
}
