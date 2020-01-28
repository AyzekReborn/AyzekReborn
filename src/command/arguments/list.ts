import { ArgumentType } from "./core";
import { CommandContext, ARGUMENT_SEPARATOR, ExpectedArgumentSeparatorError } from "../command";
import { SuggestionsBuilder, Suggestions } from "../suggestions";
import { ParseEntryPoint } from "../command";
import StringReader, { Type } from "../reader";
import { UserDisplayableError } from "../error";
import { RangeError, BadSeparatorError, FailType } from './error';

export type ListParsingStrategy<P> = {
	/**
	 * If defined, removes duplicate values
	 * based on stringified version of value
	 */
	uniqueToString?: (value: P) => string,
} & {
	type: 'withSeparator',
	// "," by default
	separator?: string,
};

export class ListArgumentType<P, V> extends ArgumentType<P[], V[]> {
	constructor(public strategy: ListParsingStrategy<P>, public singleArgumentType: ArgumentType<P, V>, public minimum: number = 1, public maximum: number = Infinity) {
		super();
		if (minimum < 1) throw new Error('minimum should be >= 1');
		if (maximum < minimum) throw new Error('maximum should be >= minimum');
	}
	async listSuggestions<P, S>(entry: ParseEntryPoint<P>, ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.singleArgumentType.listSuggestions(entry, ctx, builder);
	}

	get examples(): string[] {
		return this.singleArgumentType.examples;
	}

	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): P[] {
		let got: P[] = [];
		if (this.strategy.type === 'withSeparator') {
			const separator = this.strategy.separator ?? ',';
			while (reader.canReadAnything) {
				const gotValue = new StringReader(reader.readBeforeTestFails(t => t !== separator && t !== ' '));
				let value;
				try {
					value = this.singleArgumentType.parse(ctx, gotValue);
				} catch (e) {
					if (e instanceof UserDisplayableError) {
						if (e.reader) {
							if (!e.shouldRewindReader) {
								const cursor = e.reader.cursor;
								reader.cursor += cursor;
							}
							e.reader = reader.clone();
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
		if (got.length < this.minimum || got.length > this.maximum) {
			throw new RangeError(reader, got.length < this.minimum ? FailType.TOO_LOW : FailType.TOO_HIGH, Type.AMOUNT, got.length, this.minimum, this.maximum);
		}
		if (this.strategy.uniqueToString) {
			const stringSet = new Set();
			got = got.filter(p => {
				const stringified = this.strategy.uniqueToString!(p);
				if (stringSet.has(stringified)) return false;
				stringSet.add(stringified);
				return true;
			});
		}
		return got;
	}

	load(parsed: P[]): Promise<V[]> {
		return Promise.all(parsed.map(p => this.singleArgumentType.load(p)));
	}
}
