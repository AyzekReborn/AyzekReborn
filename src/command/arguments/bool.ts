import { SimpleArgumentType } from "./core";
import { ParseEntryPoint, CommandContext } from "../command";
import { SuggestionsBuilder } from "../suggestions";
import StringReader from "../reader";

export class BoolArgumentType extends SimpleArgumentType<boolean> {
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): boolean {
		return reader.readBoolean();
	}
	async listSuggestions<P, S>(_entry: ParseEntryPoint<P>, _ctx: CommandContext<S, any>, builder: SuggestionsBuilder) {
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
