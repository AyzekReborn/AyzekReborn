import { ArgumentType } from '@ayzek/command-parser/arguments';
import { ExpectedSomethingError } from '@ayzek/command-parser/error';
import type StringReader from '@ayzek/command-parser/reader';
import { NoSuchUserError } from '@ayzek/core/argument';
import type { AyzekParseEntryPoint } from '@ayzek/core/command';
import type DiscordApi from '.';
import type DiscordUser from './user';

export type ParsedDSUser = {
	id: string,
	reader: StringReader,
}

export class ExpectedDSUserError extends ExpectedSomethingError {
	constructor(reader: StringReader) {
		super(reader, 'discord user mention');
	}
}

export class DSUserArgumentType extends ArgumentType<ParsedDSUser, DiscordUser>{
	constructor(public api: DiscordApi) {
		super();
	}

	get examples() {
		return ['<@640920547907207199>', '<@178483185468833793>'];
	}

	parse(_ctx: AyzekParseEntryPoint, reader: StringReader): ParsedDSUser {
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
