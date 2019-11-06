import { RootCommandNode, CommandNode, LiteralCommandNode, ArgumentCommandNode } from "./tree";
import { Command, RedirectModifier, SingleRedirectModifier } from "./command";
import { Requirement } from "./requirement";
import { SuggestionProvider, Suggestions } from "./suggestions";
import { ArgumentType } from "./arguments";

export abstract class ArgumentBuilder<S, T extends ArgumentBuilder<S, T>> {
	arguments = new RootCommandNode<S>();
	command: Command<S> | null = null;
	requirement: Requirement<S> = () => true;
	target: CommandNode<S> | null = null;
	modifier: RedirectModifier<S> | null = null;
	forks: boolean = false;

	then(next: CommandNode<S> | ArgumentBuilder<S, any>) {
		if (next instanceof CommandNode) {
			return this.thenCommand(next);
		} else {
			return this.thenArg(next);
		}
	}

	thenArg(argument: ArgumentBuilder<S, any>) {
		if (this.target !== null) throw new Error("Can't add child to redirected node");
		this.arguments.addChild(argument.build());
		return this;
	}

	thenCommand(argument: CommandNode<S>) {
		if (this.target !== null) throw new Error("Can't add child to redirected node");
		this.arguments.addChild(argument);
		return this;
	}

	get argumentList() {
		return this.arguments.children;
	}

	executes(command: Command<S>) {
		this.command = command;
		return this;
	}

	requires(requirement: Requirement<S>) {
		this.requirement = requirement;
		return this;
	}

	redirect(target: CommandNode<S>, modifier: SingleRedirectModifier<S>) {
		return this.forward(target, modifier === null ? null : s => [modifier(s)], false);
	}

	fork(target: CommandNode<S>, modifier: RedirectModifier<S>) {
		return this.forward(target, modifier, true);
	}

	forward(target: CommandNode<S> | null, modifier: RedirectModifier<S> | null, forks: boolean) {
		if (this.argumentList.length !== 0) throw new Error('Cannot forward a node with children');
		this.target = target;
		this.modifier = modifier;
		this.forks = forks;
		return this;
	}

	abstract build(): CommandNode<S>;
}

export class LiteralArgumentBuilder<S> extends ArgumentBuilder<S, LiteralArgumentBuilder<S>> {
	constructor(public readonly literals: string[]) {
		super();
	}
	static literal<S>(...name: string[]): LiteralArgumentBuilder<S> {
		return new LiteralArgumentBuilder(name);
	}

	build() {
		let result = new LiteralCommandNode(this.literals, this.command, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument);
		}
		return result;
	}
}

export class RequiredArgumentBuilder<S, T> extends ArgumentBuilder<S, RequiredArgumentBuilder<S, T>> {
	suggestionsProvider: SuggestionProvider<S> = () => Promise.resolve(Suggestions.empty);
	constructor(public readonly name: string, public readonly type: ArgumentType<T>) {
		super();
	}
	static argument<S, T>(name: string, type: ArgumentType<T>): RequiredArgumentBuilder<S, T> {
		return new RequiredArgumentBuilder(name, type);
	}
	suggests(suggestionsProvider: SuggestionProvider<S>) {
		this.suggestionsProvider = suggestionsProvider;
		return this;
	}
	build(): ArgumentCommandNode<S, T> {
		let result = new ArgumentCommandNode(this.name, this.type, this.suggestionsProvider, this.command, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument);
		}
		return result;
	}
}
