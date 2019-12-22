import { ArgumentType } from "../command/arguments";
import { ParseEntryPoint } from "../command/command";
import { UserDisplayableError } from "../command/error";
import StringReader from "../command/reader";
import { Api } from "../model/api";
import { User } from "../model/conversation";

export class UserArgumentType extends ArgumentType<User<any>> {
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<User<any>> {
		if (!(ctx.sourceProvider as unknown as Api<any>)?.apiLocalUserArgumentType) throw new Error(`sourceProvider is not ayzek one (${ctx.sourceProvider})`);
		const user = await (ctx.sourceProvider as unknown as Api<any>).apiLocalUserArgumentType.parse(ctx, reader);
		await ctx.ayzek.attachToUser(user);
		return user;
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
