import { ArgumentType } from "./arguments";
import { Command, CurrentArguments, RedirectModifier, SingleRedirectModifier } from "./command";
import { Requirement } from "./requirement";
import { SuggestionProvider } from "./suggestions";
import { ArgumentCommandNode, CommandNode, LiteralCommandNode, RootCommandNode } from "./tree";

export abstract class ArgumentBuilder<S, T extends ArgumentBuilder<S, T, O>, O extends CurrentArguments> {
	arguments = new RootCommandNode<S>();
	command: Command<S, O> | null = null;
	requirement: Requirement<S> = () => true;
	target: CommandNode<S, O> | null = null;
	modifier: RedirectModifier<S, O> | null = null;
	forks: boolean = false;

	thenLiteral(names: string | string[], builderFiller: (builder: LiteralArgumentBuilder<S, O>) => void): this {
		const builder = new LiteralArgumentBuilder<S, O>(typeof names === 'string' ? [names] : names);
		builderFiller(builder);
		this.arguments.addChild(builder.build() as any);
		return this;
	}

	thenArgument<N extends string, T>(name: N, type: ArgumentType<T>, builderFiller: (builder: RequiredArgumentBuilder<N, S, T, O & { [key in N]: T }>) => void): this {
		const builder = new RequiredArgumentBuilder<N, S, T, O & { [key in N]: T }>(name, type)
		builderFiller(builder);
		this.arguments.addChild(builder.build() as any);
		return this;
	}

	get argumentList() {
		return this.arguments.children;
	}

	executes(command: Command<S, O>) {
		this.command = command;
		return this;
	}

	requires(requirement: Requirement<S>) {
		this.requirement = requirement;
		return this;
	}

	redirect(target: CommandNode<S, O>, modifier: SingleRedirectModifier<S, O>) {
		return this.forward(target, modifier === null ? null : s => [modifier(s)], false);
	}

	fork(target: CommandNode<S, O>, modifier: RedirectModifier<S, O>) {
		return this.forward(target, modifier, true);
	}

	forward(target: CommandNode<S, O> | null, modifier: RedirectModifier<S, O> | null, forks: boolean) {
		if (this.argumentList.length !== 0) throw new Error('Cannot forward a node with children');
		this.target = target;
		this.modifier = modifier;
		this.forks = forks;
		return this;
	}

	abstract build(): CommandNode<S, O>;
}

export class LiteralArgumentBuilder<S, O extends CurrentArguments> extends ArgumentBuilder<S, LiteralArgumentBuilder<S, O>, O> {
	constructor(public readonly literals: string[]) {
		super();
	}

	get literal(): string {
		return this.literals[0];
	}

	get aliases(): string[] {
		return this.literals.slice(1);
	}

	build() {
		let result: LiteralCommandNode<S, O> = new LiteralCommandNode(this.literals, this.command, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument as any);
		}
		return result;
	}
}

export class RequiredArgumentBuilder<N extends string, S, T, O extends {}> extends ArgumentBuilder<S, RequiredArgumentBuilder<N, S, T, O>, O> {
	suggestionsProvider: SuggestionProvider<S> | null = null;

	constructor(public readonly name: N, public readonly type: ArgumentType<T>) {
		super();
	}

	suggests(suggestionsProvider: SuggestionProvider<S>) {
		this.suggestionsProvider = suggestionsProvider;
		return this;
	}

	build(): ArgumentCommandNode<N, S, T, O> {
		let result = new ArgumentCommandNode<N, S, T, O>(this.name, this.type, this.suggestionsProvider, this.command, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument as any);
		}
		return result;
	}
}
