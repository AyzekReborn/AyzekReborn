import { ArgumentType } from '@ayzek/command-parser/arguments';
import { UserDisplayableError } from '@ayzek/command-parser/error';
import type StringReader from '@ayzek/command-parser/reader';
import type { Suggestions, SuggestionsBuilder } from '@ayzek/command-parser/suggestions';
import type { Api } from '@ayzek/model/api';
import type { User } from '@ayzek/model/conversation';
import type { Ayzek } from './ayzek';
import type { AyzekCommandContext, AyzekParseEntryPoint } from './command';

export type ParsedUserArgument = [Api, any, Ayzek];

export class UserArgumentType extends ArgumentType<ParsedUserArgument, User> {
	parse(ctx: AyzekParseEntryPoint, reader: StringReader): ParsedUserArgument {
		if (!ctx.source.api?.apiLocalUserArgumentType) throw new Error(`source is not ayzek one (${ctx.source})`);
		const user = ctx.source.api.apiLocalUserArgumentType.parse(ctx, reader);
		return [ctx.source.api, user, ctx.source.ayzek];
	}
	async load(parsed: ParsedUserArgument): Promise<User> {
		const user = await parsed[0].apiLocalUserArgumentType.load(parsed[1]);
		await parsed[2].attachToUser(user);
		return user;
	}
	getExamples(ctx: AyzekParseEntryPoint) {
		return ctx.source.api.apiLocalUserArgumentType.getExamples(ctx);
	}
	async listSuggestions(entry: AyzekParseEntryPoint, ctx: AyzekCommandContext, builder: SuggestionsBuilder): Promise<Suggestions> {
		const api = ctx.source.api as Api;
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
