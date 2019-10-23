
class ParsedArgument<S, T> {
	constructor(public readonly range: StringRange, public readonly result: T) {
	}
}

class SuggestionContext<S> {
	constructor(public readonly parent: CommandNode<S>, public readonly startPos: number) { }
}

class ParsedCommandNode<S> {
	constructor(public readonly node: CommandNode<S>, public readonly range: StringRange) { }
	toString() {
		return `${this.node}@${this.range}`
	}
	equals(other: this) {
		return this.node.equals(other.node) && this.range.equals(other.range);
	}
}

interface CommandContextData<S> extends CommandContext<S> { };
class CommandContext<S> {
	source: S;
	input: string;
	command: Command<S>;
	parsedArguments: { [key: string]: ParsedArgument<S, unknown> };
	rootNode: CommandNode<S>;
	nodes: ParsedCommandNode<S>[];
	range: StringRange;
	child: CommandContext<S>;
	modifier: RedirectModifier<S>;
	forks: boolean;
	constructor({ source, input, command, parsedArguments, rootNode, nodes, range, child, modifier, forks }: CommandContextData<S>) {
		Object.assign(this, {
			source, input, command, parsedArguments, rootNode, nodes, range, child, modifier, forks
		});
	}
	copyFor(source: S): CommandContext<S> {
		if (this.source === source) return this;
		let copy = new CommandContext<S>(this);
		copy.source = source;
		return copy;
	}
	get lastChild(): CommandContext<S> {
		let result: CommandContext<S> = this;
		while (result.child) {
			result = result.child;
		}
		return result;
	}
	getArgument<V>(name: string): V {
		let argument = this.parsedArguments[name];
		if (!argument) throw new Error(`No such argument "${name}" exists on this command`);
		let { result } = argument;
		return result as V;
	}
	get hasNodes(): boolean {
		return this.nodes.length !== 0;
	}
}
type Command<S> = (context: CommandContext<S>) => number;
