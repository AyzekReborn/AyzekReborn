import { ArgumentType } from "../../command/arguments";
import VKUser from "./user/user";
import { ParseEntryPoint } from "../../command/command";
import StringReader from "../../command/reader";
import VKApi from "./api";
import { NoSuchUserError } from "../../bot/argument";
import { ExpectedSomethingError } from "../../command/error";

type ParsedVKUser = {
	isBot: boolean,
	id: number,
	reader: StringReader
}


export class ExpectedVKUserError extends ExpectedSomethingError {
	constructor(public reader: StringReader) {
		super(reader, 'vk user mention');
	}
}

export class VKUserArgumentType extends ArgumentType<ParsedVKUser, VKUser>{
	constructor(public api: VKApi) {
		super();
	}

	get examples() {
		return ['[id78591039|Разраб]', '[club188280200|@ayzekng]']
	}

	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): ParsedVKUser {
		if (reader.peek() !== '[') throw new ExpectedVKUserError(reader);
		const cursor = reader.cursor;
		reader.skip();
		const remaining = reader.remaining;
		let isBot;
		if (remaining.startsWith('id')) {
			isBot = false;
			reader.skipMulti(2);
		} else if (remaining.startsWith('club')) {
			isBot = true;
			reader.skipMulti(4);
		} else {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		let id;
		try {
			id = reader.readInt();
		} catch{
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		if (reader.readChar() !== '|') {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		const charsToSkip = reader.remaining.indexOf(']') + 1;
		if (charsToSkip === 0) {
			reader.cursor = cursor;
			throw new ExpectedVKUserError(reader);
		}
		reader.cursor += charsToSkip;

		const errorReader = reader.clone();
		errorReader.cursor = cursor;
		return {
			isBot,
			id,
			reader: errorReader,
		};
	}

	async load({ isBot, id, reader }: ParsedVKUser): Promise<VKUser> {
		const user = await this.api.getApiUser(isBot ? -id : id);
		if (!user) throw new NoSuchUserError((isBot ? -id : id).toString(), reader);
		return user;
	}
}
