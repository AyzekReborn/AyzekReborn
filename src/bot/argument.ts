import { ParseEntryPoint } from "../command/command";
import { ArgumentType } from "../command/arguments";
import StringReader from "../command/reader";
import { User } from "../model/conversation";
import { Api } from "../model/api";
import { UserDisplayableError } from "../command/error";

export class UserArgumentType extends ArgumentType<User<any>> {
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<User<any>> {
		if (!(ctx.sourceProvider instanceof Api)) throw new Error('Can\'t use user argument type on non-ayzek command dispatchers');
		const user = await ctx.sourceProvider.apiLocalUserArgumentType.parse(ctx, reader);
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
