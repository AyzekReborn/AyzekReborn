import { SimpleArgumentType } from "./core";
import { ParseEntryPoint } from "../command";
import StringReader from "../reader";

export type StringType = 'single_word' | 'quotable_phraze' | 'greedy_phraze';

export class StringArgumentType extends SimpleArgumentType<string> {
	constructor(public readonly type: StringType, public readonly customExamples: string[] | null) {
		super();
	}

	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): string {
		switch (this.type) {
			case 'greedy_phraze':
				let text = reader.remaining;
				reader.cursor = reader.totalLength;
				return text;
			case 'single_word':
				return reader.readUnquotedString();
			case 'quotable_phraze':
				return reader.readString();
		}
	}

	get examples(): string[] {
		if (this.customExamples)
			return this.customExamples;
		switch (this.type) {
			case 'greedy_phraze':
				return ['word', 'words with spaces', '"and symbols"'];
			case 'single_word':
				return ['word', 'word_with_underscores'];
			case 'quotable_phraze':
				return ['"quoted phraze"', 'word'];
		}
	}
}
