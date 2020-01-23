import { LoadableArgumentType } from "../command/arguments";
import { ParseEntryPoint } from "../command/command";
import { UserDisplayableError } from "../command/error";
import StringReader from "../command/reader";
import { Api } from "../model/api";
import { User } from "../model/conversation";

// TODO: Type safety?
export class UserArgumentType extends LoadableArgumentType<[Api<any>, any], User<any>> {
	parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): [Api<any>, any] {
		if (!(ctx.sourceProvider as unknown as Api<any>)?.apiLocalUserArgumentType) throw new Error(`sourceProvider is not ayzek one (${ctx.sourceProvider})`);
		const api = (ctx.sourceProvider as unknown as Api<any>);
		const user = api.apiLocalUserArgumentType.parse(ctx, reader);
		return [api, user];
	}
	load(parsed: [Api<any>, any]): Promise<User<any>> {
		return parsed[0].apiLocalUserArgumentType.load(parsed[1]);
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
