import { ARGUMENT_SEPARATOR, CommandContext, ExpectedArgumentSeparatorError, ParseEntryPoint } from './command';
import { UserDisplayableError } from './error';
import StringRange from './range';
import StringReader, { Type } from './reader';
import { Suggestions, SuggestionsBuilder } from './suggestions';

export abstract class ArgumentType<T> {
	abstract parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<T>;
	async listSuggestions<S>(_ctx: CommandContext<S, any>, _builder: SuggestionsBuilder): Promise<Suggestions> {
		return Suggestions.empty;
	}

	get examples(): string[] {
		return [];
	}

	list(minimum: number = 0, maximum: number = Infinity): ListArgumentType<T> {
		return new ListArgumentType(this, minimum, maximum);
	}

	lazy(stringReader: ArgumentType<string>): LazyArgumentType<T> {
		return new LazyArgumentType(stringReader, this);
	}

	errorable(elseReader: ArgumentType<string>): ErrorableArgumentType<T> {
		return new ErrorableArgumentType(elseReader, this);
	}
}

export class BoolArgumentType extends ArgumentType<boolean> {
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): Promise<boolean> {
		return Promise.resolve(reader.readBoolean());
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
	TOO_LOW = 'too high',
	TOO_HIGH = 'too low',
}

class RangeError<T> extends UserDisplayableError {
	constructor(public ctx: StringReader, public failType: FailType, public type: Type, public value: T) {
		super(`${failType} ${type}: ${value}`);
		this.name = 'RangeError';
	}
}

class NumberArgumentType extends ArgumentType<number> {
	constructor(public readonly int: boolean, public readonly minimum = -Infinity, public readonly maximum = Infinity) {
		super();
	}
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): Promise<number> {
		let start = reader.cursor;
		let value = this.int ? reader.readInt() : reader.readFloat();
		if (value < this.minimum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_LOW, this.int ? Type.INT : Type.FLOAT, value);
		} else if (value > this.maximum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_HIGH, this.int ? Type.INT : Type.FLOAT, value);
		} else {
			return Promise.resolve(value);
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
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): Promise<string> {
		switch (this.type) {
			case 'greedy_phraze':
				let text = reader.remaining;
				reader.cursor = reader.totalLength;
				return Promise.resolve(text);
			case 'single_word':
				return Promise.resolve(reader.readUnquotedString());
			case 'quotable_phraze':
				return Promise.resolve(reader.readString());
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
}

export type ErrorableArgumentValue<T> = {
	value: T,
} | {
	value: null,
	error: Error,
	input: string,
}

export class ErrorableArgumentType<V> extends ArgumentType<ErrorableArgumentValue<V>>{
	constructor(public elseReader: ArgumentType<string>, public wrapped: ArgumentType<V>) {
		super();
	}
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<ErrorableArgumentValue<V>> {
		const cursor = reader.cursor;
		try {
			return {
				value: await this.wrapped.parse(ctx, reader),
			};
		} catch (error) {
			reader.cursor = cursor;
			return {
				value: null,
				error,
				input: await this.elseReader.parse(ctx, reader),
			};
		}
	}
}

export class LazyArgumentType<V> extends ArgumentType<() => Promise<V>>{
	constructor(public wrapperReader: ArgumentType<string>, public wrapped: ArgumentType<V>) {
		super();
	}
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<() => Promise<V>> {
		let readed = await this.wrapperReader.parse(ctx, reader);
		return () => this.wrapped.parse(ctx, new StringReader(readed));
	}
}

export class ListArgumentType<V> extends ArgumentType<V[]> {
	constructor(public singleArgumentType: ArgumentType<V>, public readonly minimum = 0, public readonly maximum = Infinity) {
		super();
	}
	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader): Promise<V[]> {
		const got: V[] = [];
		while (reader.canReadAnything) {
			const value = await this.singleArgumentType.parse(ctx, reader);
			got.push(value);
			if (reader.canReadAnything && reader.peek() !== ARGUMENT_SEPARATOR)
				throw new ExpectedArgumentSeparatorError(reader);
		}
		if (got.length < this.minimum || got.length > this.maximum) {
			throw new RangeError(reader, got.length < this.minimum ? FailType.TOO_LOW : FailType.TOO_HIGH, Type.AMOUNT, got.length);
		}
		return got;
	}
}
