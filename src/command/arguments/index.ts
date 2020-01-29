import StringRange from '../range';
import { BoolArgumentType } from './bool';
import { FloatArgumentType, IntArgumentType } from './number';
import { StringArgumentType, StringType } from './string';
import { ListArgumentType, ListParsingStrategy } from './list';
import { ArgumentType, SimpleArgumentType } from './core';
import { AsSimpleArgumentType } from './asSimple';
import { LazyArgumentType } from './lazy';
import { ErrorableArgumentType } from './errorable';

export function booleanArgument() {
	return new BoolArgumentType();
}

export function floatArgument(min?: number, max?: number) {
	return new FloatArgumentType(min, max);
}

export function intArgument(min?: number, max?: number) {
	return new IntArgumentType(min, max);
}

export function stringArgument(type: StringType, examples: string[] | null = null) {
	return new StringArgumentType(type, examples);
}

export function asSimpleArgument<P>(type: ArgumentType<P, any>): AsSimpleArgumentType<P> {
	return new AsSimpleArgumentType(type);
}

export function lazyArgument<P, T>(type: ArgumentType<P, T>, stringReader: StringArgumentType): LazyArgumentType<P, T> {
	return new LazyArgumentType(stringReader, type);
}

export function listArgument<P, T>(type: ArgumentType<P, T>, strategy: ListParsingStrategy<P, T>, minimum: number = 1, maximum: number = Infinity): ListArgumentType<P, T> {
	return new ListArgumentType(strategy, type, minimum, maximum);
}

export function errorableArgument<E, P, T>(type: ArgumentType<P, T>, elseReader: SimpleArgumentType<E>): ErrorableArgumentType<E, P, T> {
	return new ErrorableArgumentType(elseReader, type);
}

export { ArgumentType, SimpleArgumentType } from './core';

export type ParsedArgument<_S, T> = {
	range: StringRange,
	result: T,
}
