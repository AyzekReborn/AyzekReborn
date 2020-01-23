import { ARGUMENT_SEPARATOR, CommandContext, ExpectedArgumentSeparatorError, ParseEntryPoint } from './command';
import { CommandSyntaxError, UserDisplayableError } from './error';
import StringRange from './range';
import StringReader, { Type } from './reader';
import { Suggestions, SuggestionsBuilder } from './suggestions';
import * as _ from 'lodash';

export abstract class ArgumentType<T> {
	abstract parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): T;

	async listSuggestions<S>(_ctx: CommandContext<S, any>, _builder: SuggestionsBuilder): Promise<Suggestions> {
		return Suggestions.empty;
	}

	get examples(): string[] {
		return [];
	}

	list(strategy: ListParsingStrategy): ListArgumentType<T> {
		return new ListArgumentType(strategy, this);
	}

	lazy(stringReader: ArgumentType<string>): LazyArgumentType<T> {
		return new LazyArgumentType(stringReader, this);
	}

	errorable(elseReader: ArgumentType<string>): ErrorableArgumentType<T> {
		return new ErrorableArgumentType(elseReader, this);
	}
}

export abstract class LoadableArgumentType<P, T> extends ArgumentType<P>{
	abstract load<P>(parsed: P): Promise<T>;
	list(strategy: ListParsingStrategy): LoadableListArgumentType<P, T> {
		return new LoadableListArgumentType(strategy, this);
	}

	lazy(stringReader: ArgumentType<string>): LoadableLazyArgumentType<P, T> {
		return new LoadableLazyArgumentType(stringReader, this);
	}

	errorable(elseReader: ArgumentType<string>): LoadableErrorableArgumentType<P, T> {
		return new LoadableErrorableArgumentType(elseReader, this);
	}
}

export class BoolArgumentType extends ArgumentType<boolean> {
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): boolean {
		return reader.readBoolean();
	}
	async listSuggestions<S>(_ctx: CommandContext<S, any>, builder: SuggestionsBuilder) {
		let buffer = builder.remaining.toLowerCase();
		if ('true'.startsWith(buffer)) {
			builder.suggest('true', null);
		}
		if ('false'.startsWith(buffer)) {
			builder.suggest('false', null);
		}
		return builder.build();
	}
	get examples(): string[] {
		return ['true', 'false'];
	}
}

export function booleanArgument() {
	return new BoolArgumentType();
}

enum FailType {
	TOO_LOW = 'too low',
	TOO_HIGH = 'too high',
}

class RangeError<T> extends UserDisplayableError {
	constructor(public ctx: StringReader, public failType: FailType, public type: Type, public value: T, public min: T, public max: T) {
		super(`${failType} ${type}: ${value} (Should be ${min} <= x <= ${max})`);
		this.name = 'RangeError';
	}
}

class BadSeparatorError extends CommandSyntaxError {
	constructor(public ctx: StringReader, separator: string) {
		super(ctx, `bad input error for separator = "${separator}"`);
		this.name = 'BadSeparatorError';
	}
}

class NumberArgumentType extends ArgumentType<number> {
	constructor(public readonly int: boolean, public readonly minimum = -Infinity, public readonly maximum = Infinity) {
		super();
	}
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): number {
		let start = reader.cursor;
		let value = this.int ? reader.readInt() : reader.readFloat();
		if (value < this.minimum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_LOW, this.int ? Type.INT : Type.FLOAT, value, this.minimum, this.maximum);
		} else if (value > this.maximum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_HIGH, this.int ? Type.INT : Type.FLOAT, value, this.minimum, this.maximum);
		} else {
			return value;
		}
	}
	get examples(): string[] {
		let fixed = this.int ? 0 : 2;
		return [this.minimum.toFixed(fixed), ((this.minimum + this.maximum) / 2).toFixed(fixed), this.maximum.toFixed(fixed)];
	}
	toString() {
		let name = this.int ? 'int' : 'float';
		if (this.minimum === -Infinity && this.maximum === Infinity) {
			return `${name}()`;
		} else if (this.maximum === Infinity) {
			return `${name}(${this.minimum})`;
		} else {
			return `${name}(${this.minimum}, ${this.maximum})`;
		}
	}
}

export class FloatArgumentType extends NumberArgumentType {
	constructor(minimum: number = -Infinity, maximum: number = Infinity) {
		super(false, minimum, maximum);
	}
}

export class IntArgumentType extends NumberArgumentType {
	constructor(minimum: number = -Infinity, maximum: number = Infinity) {
		super(true, minimum, maximum);
	}
}

export function floatArgument(min?: number, max?: number) {
	return new FloatArgumentType(min, max);
}

export function intArgument(min?: number, max?: number) {
	return new IntArgumentType(min, max);
}

export type StringType = 'single_word' | 'quotable_phraze' | 'greedy_phraze';

export class StringArgumentType extends ArgumentType<string> {
	constructor(public readonly type: StringType) {
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

export function stringArgument(type: StringType) {
	return new StringArgumentType(type);
}

export type ParsedArgument<_S, T> = {
	range: StringRange,
	result: T,
	argumentType: ArgumentType<T>,
}

export type ErrorableArgumentValue<T> = {
	/**
	 * Parsed value
	 */
	value: T,
	/**
	 * elseReader result for loadable errorable
	 */
	input: string | null,
} | {
	value: null,
	/**
	 * Parse/load error
	 */
	error: Error,
	input: string,
}

function readErrorable<P, V>(ctx: ParseEntryPoint<P>, wrapped: ArgumentType<V>, elseReader: ArgumentType<string>, reader: StringReader, inputNeeded: boolean): ErrorableArgumentValue<V> {
	const cursor = reader.cursor;
	try {
		return {
			value: wrapped.parse(ctx, reader),
			input: inputNeeded ? elseReader.parse(ctx, reader) : null,
		};
	} catch (error) {
		reader.cursor = cursor;
		return {
			value: null,
			error,
			input: elseReader.parse(ctx, reader),
		};
	}
}

export class ErrorableArgumentType<V> extends ArgumentType<ErrorableArgumentValue<V>>{
	constructor(public elseReader: ArgumentType<string>, public wrapped: ArgumentType<V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}
	parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): ErrorableArgumentValue<V> {
		return readErrorable(ctx, this.wrapped, this.elseReader, reader, false);
	}
}
export class LoadableErrorableArgumentType<P, V> extends LoadableArgumentType<ErrorableArgumentValue<P>, ErrorableArgumentValue<V>> {
	constructor(public elseReader: ArgumentType<string>, public wrapped: LoadableArgumentType<P, V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}
	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): ErrorableArgumentValue<P> {
		return readErrorable(ctx, this.wrapped, this.elseReader, reader, true);
	}
	async load<P>(parsed: ErrorableArgumentValue<P>): Promise<ErrorableArgumentValue<V>> {
		if (parsed.value === null)
			return parsed as ErrorableArgumentValue<V>;
		try {
			return {
				value: await this.wrapped.load(parsed.value!),
				input: null,
			};
		} catch (e) {
			return {
				value: null,
				error: e,
				input: parsed.input!,
			}
		}
	}
}

export class LazyArgumentType<V> extends ArgumentType<() => V>{
	constructor(public wrapperReader: ArgumentType<string>, public wrapped: ArgumentType<V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}
	parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): () => V {
		let readed = this.wrapperReader.parse(ctx, reader);
		return () => this.wrapped.parse(ctx, new StringReader(readed));
	}
}

export class LoadableLazyArgumentType<P, V> extends LoadableArgumentType<() => P, () => Promise<V>>{
	constructor(public wrapperReader: ArgumentType<string>, public wrapped: LoadableArgumentType<P, V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}
	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): () => P {
		let readed = this.wrapperReader.parse(ctx, reader);
		return () => this.wrapped.parse(ctx, new StringReader(readed));
	}
	load(parsed: () => P): Promise<() => Promise<V>> {
		return Promise.resolve(() => {
			const gotParsed = parsed();
			return this.wrapped.load(gotParsed);
		});
	}
}

export type ListParsingStrategy = {
	unique?: boolean,
	minimum: number,
	maximum: number,
} & ({
	type: 'repeatBeforeError',
} | {
	type: 'noSpacesWithSeparator',
	// "," by default
	separator?: string,
});

function readList<P, V>(ctx: ParseEntryPoint<P>, strategy: ListParsingStrategy, singleArgumentType: ArgumentType<V>, reader: StringReader) {
	const got: V[] = [];
	if (strategy.type === 'repeatBeforeError') {
		while (reader.canReadAnything) {
			let lastSuccessPos = reader.cursor;
			try {
				const value = singleArgumentType.parse(ctx, reader);
				got.push(value);
				if (reader.canReadAnything) {
					if (reader.peek() !== ARGUMENT_SEPARATOR)
						throw new ExpectedArgumentSeparatorError(reader);
					else
						reader.skip();
				}
				lastSuccessPos = reader.cursor;
			} catch (error) {
				reader.cursor = lastSuccessPos;
				break;
			}
		}
	} if (strategy.type === 'noSpacesWithSeparator') {
		const separator = strategy.separator ?? ',';
		while (reader.canReadAnything) {
			const gotValue = new StringReader(reader.readBeforeTestFails(t => t !== separator && t !== ' '));
			let value;
			try {
				value = singleArgumentType.parse(ctx, gotValue);
			} catch (e) {
				if (e instanceof UserDisplayableError) {
					if (e.reader) {
						const cursor = e.reader.cursor;
						reader.cursor += cursor;
						e.reader = reader;
					}
				}
				throw e;
			}
			if (gotValue.cursor !== gotValue.string.length)
				throw new BadSeparatorError(gotValue, separator);
			got.push(value);
			if (reader.canReadAnything) {
				if (reader.peek() === separator) {
					reader.skip();
				} else {
					break;
				}
				if (!reader.canReadAnything)
					throw new ExpectedArgumentSeparatorError(reader);
				if (reader.peek() === ARGUMENT_SEPARATOR)
					reader.skip();
			}
		}
	} else {
		throw new Error('Not handled');
	}
	if (got.length < strategy.minimum || got.length > strategy.maximum) {
		throw new RangeError(reader, got.length < strategy.minimum ? FailType.TOO_LOW : FailType.TOO_HIGH, Type.AMOUNT, got.length, strategy.minimum, strategy.maximum);
	}
	if (strategy.unique) {
		return _.uniq(got);
	}
	return got;
}

export class ListArgumentType<V> extends ArgumentType<V[]> {
	constructor(public strategy: ListParsingStrategy, public singleArgumentType: ArgumentType<V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.singleArgumentType.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.singleArgumentType.examples;
	}
	parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): V[] {
		return readList(ctx, this.strategy, this.singleArgumentType, reader);
	}
}

export class LoadableListArgumentType<P, V> extends LoadableArgumentType<P[], V[]> {
	constructor(public strategy: ListParsingStrategy, public singleArgumentType: LoadableArgumentType<P, V>) {
		super();
	}
	async listSuggestions<S>(ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.singleArgumentType.listSuggestions(ctx, builder);
	}

	get examples(): string[] {
		return this.singleArgumentType.examples;
	}
	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): P[] {
		return readList(ctx, this.strategy, this.singleArgumentType, reader);
	}

	load(parsed: P[]): Promise<V[]> {
		return Promise.all(parsed.map(p => this.singleArgumentType.load(p)));
	}
}
