import { ArgumentType, SimpleArgumentType } from "./core";
import { CommandContext } from "../command";
import { SuggestionsBuilder, Suggestions } from "../suggestions";
import { ParseEntryPoint } from "../command";
import StringReader from "../reader";
import { MaybePromise } from "../../api/promiseMap";

export class LazyArgumentType<P, V> extends ArgumentType<() => P, () => MaybePromise<V>>{
	constructor(public wrapperReader: SimpleArgumentType<string>, public wrapped: ArgumentType<P, V>) {
		super();
	}
	async listSuggestions<P, S>(entry: ParseEntryPoint<P>, ctx: CommandContext<S, any>, builder: SuggestionsBuilder): Promise<Suggestions> {
		return this.wrapped.listSuggestions(entry, ctx, builder);
	}

	get examples(): string[] {
		return this.wrapped.examples;
	}

	parse<S>(ctx: ParseEntryPoint<S>, reader: StringReader): () => P {
		let readed = this.wrapperReader.parse(ctx, reader);
		return () => this.wrapped.parse(ctx, new StringReader(readed));
	}

	load(parsed: () => P): () => MaybePromise<V> {
		return () => {
			const gotParsed = parsed();
			return this.wrapped.load(gotParsed);
		};
	}
}
