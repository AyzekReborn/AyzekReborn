/// <reference path="tree.d.ts"/>
import StringRange from "./range";
import CommandContextBuilder, { Command, CommandContext, RedirectModifier, ParseEntryPoint } from "./command";
import { Requirement } from "./requirement";
import isEqual from 'is-equal';
import StringReader from "./reader";
import { SuggestionsBuilder, Suggestions, SuggestionProvider, Suggestion } from "./suggestions";
import { ArgumentType } from "./arguments";
import { RequiredArgumentBuilder, LiteralArgumentBuilder, ArgumentBuilder } from "./builder";
import { UserDisplayableError, CommandSyntaxError } from "./error";


export type AmbiguityConsumer<S> = (parent: CommandNode<S>, child: CommandNode<S>, sibling: CommandNode<S>, inputs: Set<string>) => void;
export abstract class CommandNode<S> {
	childrenMap: Map<string, CommandNode<S>> = new Map();
	literals: Map<string, LiteralCommandNode<S>> = new Map();
	arguments: Map<string, ArgumentCommandNode<S, unknown>> = new Map();
	constructor(
		public command: Command<S> | null,
		public readonly requirement: Requirement<S>,
		public readonly redirect: CommandNode<S> | null,
		public readonly modifier: RedirectModifier<S> | null,
		public readonly forks: boolean,
	) { }
	get children() { return Array.from(this.childrenMap.values()); }
	getChild(name: string) {
		return this.childrenMap.get(name);
	}
	canUse(source: S): boolean {
		if (!this.requirement(source)) return false;
		if (this.command) return true;
		if (this.redirect && this.redirect.canUse(source)) return true;
		return this.children.some(child => child.canUse(source));
	}
	removeChild(node: CommandNode<S>) {
		this.childrenMap.delete(node.name);
		if (node instanceof LiteralCommandNode) {
			this.literals.delete(node.name);
		} else if (node instanceof ArgumentCommandNode) {
			this.arguments.delete(node.name);
		}
	}
	addChild(node: CommandNode<S>) {
		if (node instanceof RootCommandNode) throw new Error('Cannot add RootCommandNode as child');
		let child = this.getChild(node.name);
		if (child) {
			if (node.command !== null) {
				child.command = node.command;
			}
			for (let grandchild of node.children) {
				child.addChild(grandchild);
			}
		} else {
			this.childrenMap.set(node.name, node);
			if (node instanceof LiteralCommandNode) {
				this.literals.set(node.name, node);
			} else if (node instanceof ArgumentCommandNode) {
				this.arguments.set(node.name, node);
			}
		}
		this.childrenMap = new Map(Array.from(this.childrenMap.entries()).sort((a, b) => a[1].compareTo(b[1])))
	}
	async findAmbiguities<P>(ctx: ParseEntryPoint<P>, consumer: AmbiguityConsumer<S>) {
		let matches = new Set<string>();
		for (let child of this.children) {
			for (let sibling of this.children) {
				if (child === sibling)
					continue;
				for (let input of child.examples) {
					if (await sibling.isValidInput(ctx, input)) {
						matches.add(input);
					}
				}
				if (matches.size > 0) {
					consumer(this, child, sibling, matches);
					matches = new Set<string>();
				}
			}
			await child.findAmbiguities(ctx, consumer);
		}
	}
	abstract async isValidInput<P>(ctx: ParseEntryPoint<P>, input: string): Promise<boolean>;
	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!isEqual(this.childrenMap, other.childrenMap)) return false;
		if (this.command !== other.command) return false;
		return true;
	}
	abstract get name(): string;
	abstract get usage(): string;
	abstract parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader, contextBuilder: CommandContextBuilder<S>): Promise<void>;
	abstract async listSuggestions(context: CommandContext<S>, builder: SuggestionsBuilder): Promise<Suggestions>;

	abstract createBuilder(): ArgumentBuilder<S, any>;
	abstract get sortedKey(): string;

	getRelevant(input: StringReader): Array<CommandNode<S>> {
		if (this.literals.size > 0) {
			let cursor = input.cursor;
			while (input.canReadAnything && input.peek() !== ' ')
				input.skip();
			let text = input.string.substring(cursor, input.cursor);
			input.cursor = cursor;
			let literal = [...this.literals.values()].filter(l => l.isMe(text))[0];
			if (literal) {
				return [literal];
			} else {
				return Array.from(this.arguments.values());
			}
		} else {
			return Array.from(this.arguments.values());
		}
	}

	compareTo(other: CommandNode<S>): number {
		if (this instanceof LiteralCommandNode === other instanceof LiteralCommandNode) {
			return this.sortedKey.localeCompare(other.sortedKey);
		} else {
			return (other instanceof LiteralCommandNode) ? 1 : -1;
		}
	}

	abstract get examples(): string[];
}

export class LiteralError extends CommandSyntaxError {
	constructor(public reader: StringReader, public literal: string) {
		super(reader, `Unknown literal at ${reader}: ${literal}`);
		this.name = 'LiteralError';
	}
}

export class LiteralCommandNode<S> extends CommandNode<S> {
	constructor(
		public readonly literalNames: string[],
		command: Command<S> | null,
		requirement: Requirement<S>,
		redirect: CommandNode<S> | null,
		modifier: RedirectModifier<S> | null,
		forks: boolean,
	) {
		super(command, requirement, redirect, modifier, forks);
	}

	get name(): string {
		return this.literal;
	}

	get literal(): string {
		return this.literalNames[0];
	}

	get aliases(): string[] {
		return this.literalNames.slice(1);
	}

	isMe(name: string) {
		return this.literalNames.includes(name.toLowerCase());
	}

	async parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader, contextBuilder: CommandContextBuilder<S>) {
		let start = reader.cursor;
		let end = this._parse(reader);
		if (end > -1) {
			contextBuilder.withNode(this, StringRange.between(start, end));
			return;
		}
		throw new LiteralError(reader, this.name);
	}

	private _parse(reader: StringReader) {
		let start = reader.cursor;
		for (const literal of this.literalNames) {
			if (reader.canRead(literal.length)) {
				let end = start + literal.length;
				if (reader.string.substring(start, end) === literal) {
					reader.cursor = end;
					if (!reader.canReadAnything || reader.peek() === ' ') {
						return end;
					} else {
						reader.cursor = start;
					}
				}
			}
		}
		return -1;
	}

	async listSuggestions(_context: CommandContext<S>, builder: SuggestionsBuilder): Promise<Suggestions> {
		const remaining = builder.remaining.toLowerCase();
		for (const literal of this.literalNames) {
			if (literal.toLowerCase().startsWith(remaining)) {
				const other = this.literalNames.filter(e => e !== literal);
				return builder.suggest(literal, other.length === 0 ? null : `${other.join(', ')}`).build();
			}
		}
		return Suggestions.empty;
	}

	isValidInput<P>(_ctx: ParseEntryPoint<P>, input: string): Promise<boolean> {
		return Promise.resolve(this._parse(new StringReader(input)) > -1);
	}

	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!(other instanceof LiteralCommandNode)) return false;
		if (this.literalNames !== other.literalNames) return false;
		return super.equals(other);
	}

	get usage() {
		return this.name;
	}

	createBuilder() {
		let builder: LiteralArgumentBuilder<S> = LiteralArgumentBuilder.literal(...this.literalNames);
		builder.requires(this.requirement);
		builder.forward(this.redirect, this.modifier, this.forks);
		if (this.command !== null) {
			builder.executes(this.command);
		}
		return builder;
	}

	get sortedKey() {
		return this.name;
	}

	get examples() {
		return [this.name];
	}

	toString() {
		return `<literal ${this.name}>`;
	}
}

export class RootCommandNode<S> extends CommandNode<S> {
	constructor() {
		super(null, () => true, null, s => [s.source], false);
	}
	get name() {
		return '';
	}
	get usage() {
		return '';
	}
	async parse() { };
	async listSuggestions(): Promise<Suggestions> {
		return Suggestions.empty;
	}
	async isValidInput() {
		return false;
	}

	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!(other instanceof RootCommandNode)) return false;
		return super.equals(other);
	}

	createBuilder(): ArgumentBuilder<S, any> {
		throw new Error('Cannot convert root to builder');
	}

	get sortedKey() {
		return '';
	}

	get examples(): string[] {
		return [];
	}

	toString() {
		return '<root>';
	}
}

export class ArgumentCommandNode<S, T> extends CommandNode<S> {
	constructor(
		public readonly name: string,
		public readonly type: ArgumentType<T>,
		public readonly customSuggestions: SuggestionProvider<S> | null,
		command: Command<S> | null,
		requirement: Requirement<S>,
		redirect: CommandNode<S> | null,
		modifier: RedirectModifier<S> | null,
		forks: boolean,
	) {
		super(command, requirement, redirect, modifier, forks);
	}

	get usage() {
		return `<${this.name}>`;
	}

	async parse<P>(ctx: ParseEntryPoint<P>, reader: StringReader, contextBuilder: CommandContextBuilder<S>) {
		let start = reader.cursor;
		let parsed = {
			range: StringRange.between(start, reader.cursor),
			result: await this.type.parse(ctx, reader),
		};

		contextBuilder.withArgument(this.name, parsed);
		contextBuilder.withNode(this, parsed.range);
	}

	async listSuggestions(ctx: CommandContext<S>, builder: SuggestionsBuilder): Promise<Suggestions> {
		let got: Suggestions;
		if (this.customSuggestions) {
			got = await this.customSuggestions(ctx, builder);
		} else {
			got = await this.type.listSuggestions(ctx, builder);
		}
		return got;
	}

	createBuilder(): RequiredArgumentBuilder<S, T> {
		let builder: RequiredArgumentBuilder<S, T> = RequiredArgumentBuilder.argument(this.name, this.type);
		builder.requires(this.requirement);
		builder.forward(this.redirect, this.modifier, this.forks);
		if (this.customSuggestions)
			builder.suggests(this.customSuggestions);
		if (this.command !== null) {
			builder.executes(this.command);
		}
		return builder;
	}

	async isValidInput<P>(ctx: ParseEntryPoint<P>, input: string) {
		try {
			let reader = new StringReader(input);
			await this.type.parse(ctx, reader);
			return !reader.canReadAnything || reader.peek() == ' ';
		} catch {
			return false;
		}
	}

	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!(other instanceof ArgumentCommandNode)) return false;
		if (this.name !== other.name) return false;
		if (this.type !== other.type) return false;
		return super.equals(other);
	}

	get sortedKey() {
		return this.name;
	}

	get examples() {
		return this.type.examples;
	}

	toString() {
		return `<argument ${this.name}:${this.type}>`
	}
}

export class ParsedCommandNode<S> {
	constructor(public readonly node: CommandNode<S>, public readonly range: StringRange) { }
	toString() {
		return `${this.node}@${this.range}`
	}
	equals(other: this) {
		return this.node.equals(other.node) && this.range.equals(other.range);
	}
}
