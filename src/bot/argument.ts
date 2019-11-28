import { ArgumentType } from "../command/arguments";
import { ParseEntryPoint } from "../command/command";
import { UserDisplayableError } from "../command/error";
import StringReader from "../command/reader";
import { Api } from "../model/api";
import { User } from "../model/conversation";

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
