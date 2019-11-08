import StringReader from "./reader";

export class UserDisplayableError extends Error {
	constructor(description: string, public reader?: StringReader) {
		super(description);
		this.name = 'UserDisplayableError';
	}
}

export class CommandSyntaxError extends UserDisplayableError {
	constructor(public reader: StringReader, description: string) {
		super(description, reader);
		this.name = 'CommandSyntaxError';
	}
}

export class ExpectedSomethingError extends CommandSyntaxError {
	constructor(reader: StringReader, something: string) {
		super(reader, `Expected "${something}"`);
		this.name = 'ExpectedSomethingError';
	}
}

export class UnknownSomethingError extends CommandSyntaxError {
	constructor(reader: StringReader, something: string) {
		super(reader, `Unknown ${something}`);
		this.name = 'UnknownSomethingError';
	}
}
