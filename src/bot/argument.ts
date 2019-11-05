import { ParseEntryPoint } from "../command/command";
import { ArgumentType } from "../command/arguments";
import StringReader from "../command/reader";
import { User } from "../model/conversation";
import { Api } from "../model/api";

export class UserArgumentType extends ArgumentType<User<any>> {
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<User<any>> {
		if (!(ctx.sourceProvider instanceof Api)) throw new Error('Can\'t use user argument type on non-ayzek command dispatchers');
		return await ctx.sourceProvider.apiLocalUserArgumentType.parse(ctx, reader);
	}
}

export function userArgument() {
	return new UserArgumentType();
}
