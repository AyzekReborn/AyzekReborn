import StringReader from "../reader";
import { ArgumentType, SimpleArgumentType } from "./core";
import { CommandContext } from "../command";
import { SuggestionsBuilder, Suggestions } from "../suggestions";
import { ParseEntryPoint } from "../command";

export type ParsedErrorableArgumentSuccess<E, P> = {
	input: StringReader,
	parsedValue: P,
	elseInput: E,
};

export type ParsedErrorableArgumentError<E> = {
	input: StringReader,
	parsedValue: null,
	error: Error,
	elseInput: E,
};

export type ParsedErrorableArgumentValue<E, P> = ParsedErrorableArgumentSuccess<E, P> | ParsedErrorableArgumentError<E>;

function isParsingErrored<E, P>(parsed: ParsedErrorableArgumentValue<E, P>): parsed is ParsedErrorableArgumentError<E> {
	return parsed.parsedValue === null;
}

export type LoadedErrorableArgumentValue<E, P, T> = {
	/**
	 * Parse input
	 */
	input: StringReader,
	elseInput: E,
} & ({
	/**
	 * Loaded value
	 */
	value: T,
	parsedValue: P,
} | ({
	value: null,
	error: Error,
} & ({
	erroredAt: 'loading',
	parsedValue: P,
} | {
	erroredAt: 'parsing',
	parsedValue: null,
})));

export class ErrorableArgumentType<E, P, T> extends ArgumentType<ParsedErrorableArgumentValue<E, P>, LoadedErrorableArgumentValue<E, P, T>>{
	constructor(public elseReader: SimpleArgumentType<E>, public wrapped: ArgumentType<P, T>) {
		super();
	}
	async listSuggestions<P, S>(entry: ParseEntryPoint<P>, ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(entry, ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}
	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): ParsedErrorableArgumentValue<E, P> {
		const cursor = reader.cursor;
		const clonedReader = reader.clone();
		try {
			return {
				input: clonedReader,
				parsedValue: this.wrapped.parse(ctx, reader),
				elseInput: this.elseReader.load(this.elseReader.parse(ctx, clonedReader.clone())),
			}
		} catch (error) {
			reader.cursor = cursor;
			return {
				input: clonedReader,
				parsedValue: null,
				error,
				elseInput: this.elseReader.load(this.elseReader.parse(ctx, reader)),
			};
		}
	}

	async load<P>(parsed: ParsedErrorableArgumentValue<E, P>): Promise<LoadedErrorableArgumentValue<E, P, T>> {
		if (isParsingErrored(parsed)) {
			return {
				input: parsed.input,
				value: null,
				parsedValue: null,
				erroredAt: 'parsing',
				error: parsed.error,
				elseInput: parsed.elseInput,
			};
		}
		try {
			return {
				input: parsed.input,
				value: await this.wrapped.load(parsed.parsedValue as any),
				parsedValue: parsed.parsedValue,
				elseInput: parsed.elseInput,
			};
		} catch (error) {
			return {
				input: parsed.input,
				value: null,
				parsedValue: parsed.parsedValue,
				erroredAt: 'loading',
				error,
				elseInput: parsed.elseInput,
			}
		}
	}
}
