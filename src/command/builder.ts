import { ArgumentType } from "./arguments";
import { Command, CurrentArguments, RedirectModifier, SingleRedirectModifier } from "./command";
import { Requirement } from "./requirement";
import { SuggestionProvider } from "./suggestions";
import { ArgumentCommandNode, CommandNode, LiteralCommandNode, RootCommandNode } from "./tree";

export abstract class ArgumentBuilder<Source,
	This extends ArgumentBuilder<Source, This, ArgumentTypeMap>,
	ArgumentTypeMap extends CurrentArguments> {

	arguments = new RootCommandNode<Source>();
	command: Command<Source, ArgumentTypeMap> | null = null;
	commandDescription: string | null = null;

	requirement: Requirement<Source> = () => true;
	target: CommandNode<Source, ArgumentTypeMap> | null = null;
	modifier: RedirectModifier<Source, ArgumentTypeMap> | null = null;
	forks: boolean = false;

	then(builder: LiteralArgumentBuilder<Source, ArgumentTypeMap>): this {
		this.arguments.addChild(builder.build() as any);
		return this;
	}

	thenLiteral(names: string | string[], builderFiller: (builder: LiteralArgumentBuilder<Source, ArgumentTypeMap>) => void): this {
		const builder = new LiteralArgumentBuilder<Source, ArgumentTypeMap>(typeof names === 'string' ? [names] : names);
		builderFiller(builder);
		this.arguments.addChild(builder.build() as any);
		return this;
	}

	thenArgument<Name extends string, ThisArgumentParsedType, ThisArgumentType>(
		name: Name,
		type: ArgumentType<ThisArgumentParsedType, ThisArgumentType>,
		builderFiller: (builder: RequiredArgumentBuilder<Name, Source, ThisArgumentParsedType, ThisArgumentType, ArgumentTypeMap & { [key in Name]: ThisArgumentType }>) => void
	): this {
		const builder = new RequiredArgumentBuilder<
			Name, Source, ThisArgumentParsedType, ThisArgumentType,
			ArgumentTypeMap & { [key in Name]: ThisArgumentType }
		>(name, type);
		builderFiller(builder);
		this.arguments.addChild(builder.build() as any);
		return this;
	}

	get argumentList() {
		return this.arguments.children;
	}

	executes(command: Command<Source, ArgumentTypeMap>, commandDescription: string | null = null) {
		this.command = command;
		this.commandDescription = commandDescription;
		return this;
	}

	requires(requirement: Requirement<Source>) {
		this.requirement = requirement;
		return this;
	}

	redirect(target: CommandNode<Source, ArgumentTypeMap>, modifier: SingleRedirectModifier<Source, ArgumentTypeMap> | null = null, commandDescription: string | null = null) {
		this.commandDescription = commandDescription;
		return this.forward(target, modifier === null ? null : s => [modifier(s)], false);
	}

	fork(target: CommandNode<Source, ArgumentTypeMap>, modifier: RedirectModifier<Source, ArgumentTypeMap> | null = null) {
		return this.forward(target, modifier, true);
	}

	forward(
		target: CommandNode<Source, ArgumentTypeMap> | null,
		modifier: RedirectModifier<Source, ArgumentTypeMap> | null,
		forks: boolean
	) {
		if (this.argumentList.length !== 0) throw new Error('Cannot forward a node with children');
		this.target = target;
		this.modifier = modifier;
		this.forks = forks;
		return this;
	}

	abstract build(): CommandNode<Source, ArgumentTypeMap>;
}

export class LiteralArgumentBuilder<Source, ArgumentTypeMap extends CurrentArguments> extends ArgumentBuilder<Source, LiteralArgumentBuilder<Source, ArgumentTypeMap>, ArgumentTypeMap> {
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
		let result: LiteralCommandNode<Source, ArgumentTypeMap> = new LiteralCommandNode(this.literals, this.command, this.commandDescription, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument as any);
		}
		return result;
	}
}

export class RequiredArgumentBuilder<Name extends string, Source, ParsedThisArgument, ThisArgument, ArgumentTypeMap extends CurrentArguments> extends ArgumentBuilder<Source, RequiredArgumentBuilder<Name, Source, ParsedThisArgument, ThisArgument, CurrentArguments>, ArgumentTypeMap> {
	suggestionsProvider: SuggestionProvider<Source> | null = null;

	constructor(public readonly name: Name, public readonly type: ArgumentType<ParsedThisArgument, ThisArgument>) {
		super();
	}

	suggests(suggestionsProvider: SuggestionProvider<Source>) {
		this.suggestionsProvider = suggestionsProvider;
		return this;
	}

	build(): ArgumentCommandNode<Name, Source, ParsedThisArgument, ThisArgument, ArgumentTypeMap> {
		let result = new ArgumentCommandNode<Name, Source, ParsedThisArgument, ThisArgument, ArgumentTypeMap>(this.name, this.type, this.suggestionsProvider, this.command, this.commandDescription, this.requirement, this.target, this.modifier, this.forks);
		for (let argument of this.argumentList) {
			result.addChild(argument as any);
		}
		return result;
	}
}
