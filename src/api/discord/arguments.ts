import StringReader from "../../command/reader";
import { LoadableArgumentType } from "../../command/arguments";
import DiscordUser from "./user";
import DiscordApi from "./api";
import { ParseEntryPoint } from "../../command/command";
import { NoSuchUserError } from "../../bot/argument";
import { ExpectedSomethingError } from "../../command/error";

export type ParsedDSUser = {
	id: string,
	reader: StringReader,
}

export class ExpectedDSUserError extends ExpectedSomethingError {
	constructor(reader: StringReader) {
		super(reader, `discord user mention`);
	}
}

export class DSUserArgumentType extends LoadableArgumentType<ParsedDSUser, DiscordUser>{
	constructor(public api: DiscordApi) {
		super();
	}

	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): ParsedDSUser {
		if (reader.peek() !== '<') throw new ExpectedDSUserError(reader);
		const cursor = reader.cursor;
		reader.skip();
		if (reader.peek() !== '@') {
			reader.cursor = cursor;
			throw new ExpectedDSUserError(reader);
		}
		reader.skip();
		const id = reader.readBeforeTestFails(char => /[0-9]/.test(char));
		if (reader.peek() !== '>') {
			reader.cursor = cursor;
			throw new ExpectedDSUserError(reader);
		}
		reader.skip();

		const errorReader = reader.clone();
		errorReader.cursor = cursor;
		return {
			id,
			reader: errorReader,
		};
	}

	async load({ id, reader }: ParsedDSUser): Promise<DiscordUser> {
		const user = await this.api.getApiUser(id);
		if (!user) {
			throw new NoSuchUserError(id.toString(), reader);
		}
		return user;
	}
}
