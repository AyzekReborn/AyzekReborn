import { ParseEntryPoint } from "../command";
import StringReader from "../reader";
import { MaybePromise } from "../../api/promiseMap";
import { CommandContext } from "../command";
import { SuggestionsBuilder, Suggestions } from "../suggestions";
import { ListParsingStrategy, ListArgumentType } from "./list";
import { StringArgumentType } from "./string";
import { ErrorableArgumentType } from "./errorable";
import { LazyArgumentType } from "./lazy";
import { AsSimpleArgumentType } from "./asSimple";

export abstract class ArgumentType<P, T> {
	/**
	 * Parses data from reader, should not perform any caching/data loading
	 * @param ctx parsing context
	 * @param reader command reader
	 */
	abstract parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): P;
	/**
	 * Loads parsed data
	 * @param parsed parsed data
	 */
	abstract load(parsed: P): MaybePromise<T>;

	/**
	 * Fill suggestion builder with actual possible completions
	 * by default suggests all examples
	 * @param ctx parsing context
	 * @param builder
	 */
	async listSuggestions<P, S>(entry: ParseEntryPoint<P>, _ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		const remaining = builder.remaining;
		for (const literal of this.getExamples(entry))
			if (literal.startsWith(remaining))
				builder.suggest(literal, null);
		return builder.build();
	}

	getExamples<P>(_entry: ParseEntryPoint<P>): string[] {
		return this.examples;
	}

	/**
	 * Argument examples, used by default for listSuggestions and
	 * for conflict search
	 */
	get examples(): string[] {
		return [];
	}

	// /**
	//  * Skips loading of argument
	//  */
	// asSimple(): AsSimpleArgumentType<P> {
	// 	return new AsSimpleArgumentType(this);
	// }

	// /**
	//  * Repeat current argument n times
	//  * @param strategy separator/argument count/etc
	//  */
	// list(strategy: ListParsingStrategy<P>): ListArgumentType<P, T> {
	// 	return new ListArgumentType(strategy, this);
	// }

	// /**
	//  * Parsing will be performed on argument get
	//  * @param stringReader reader which prepares data for runtime parsing
	//  */
	// lazy(stringReader: StringArgumentType): LazyArgumentType<P, T> {
	// 	return new LazyArgumentType(stringReader, this);
	// }

	// /**
	//  * Argument parsing/loading can fail, loaded argument/error will be passed to context
	//  * @param elseReader reader which should be used in case of failure
	//  * @param <E> type returned in case of failure
	//  */
	// errorable<E>(elseReader: SimpleArgumentType<E>): ErrorableArgumentType<E, P, T> {
	// 	return new ErrorableArgumentType(elseReader, this);
	// }
}

export abstract class SimpleArgumentType<T> extends ArgumentType<T, T>{
	load(parsed: T): T {
		return parsed;
	}
}
