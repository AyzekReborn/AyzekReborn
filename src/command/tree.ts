/// <reference path="tree.d.ts"/>
import StringRange from "./range";
import CommandContextBuilder, { Command, CommandContext, RedirectModifier } from "./command";
import { Requirement } from "./requirement";
import isEqual from 'is-equal';
import StringReader from "./reader";
import { SuggestionsBuilder, Suggestions, SuggestionProvider } from "./suggestions";
import { ArgumentType, ParsedArgument } from "./arguments";
import { RequiredArgumentBuilder, LiteralArgumentBuilder, ArgumentBuilder } from "./builder";


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
	canUse(source: S) {
		return this.requirement(source);
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
	findAmbiguities(consumer: AmbiguityConsumer<S>) {
		let matches = new Set<string>();
		for (let child of this.children) {
			for (let sibling of this.children) {
				if (child === sibling)
					continue;
				for (let input of child.examples) {
					if (sibling.isValidInput(input)) {
						matches.add(input);
					}
				}
				if (matches.size > 0) {
					consumer(this, child, sibling, matches);
					matches = new Set<string>();
				}
			}
			child.findAmbiguities(consumer);
		}
	}
	abstract isValidInput(input: string): boolean;
	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!isEqual(this.childrenMap, other.childrenMap)) return false;
		if (this.command !== other.command) return false;
		return true;
	}
	abstract get name(): string;
	abstract get usage(): string;
	abstract parse(reader: StringReader, contextBuilder: CommandContextBuilder<S>): void;
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
			let literal = this.literals.get(text.toLowerCase());
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

export class LiteralError extends Error {
	constructor(public reader: StringReader, public literal: string) {
		super(`${reader}: ${literal}`);
	}
}

export class LiteralCommandNode<S> extends CommandNode<S> {
	constructor(
		public readonly literal: string,
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
	parse(reader: StringReader, contextBuilder: CommandContextBuilder<S>) {
		let start = reader.cursor;
		let end = this._parse(reader);
		if (end > -1) {
			contextBuilder.withNode(this, StringRange.between(start, end));
			return;
		}
		throw new LiteralError(reader, this.literal);
	}

	private _parse(reader: StringReader) {
		let start = reader.cursor;
		if (reader.canRead(this.literal.length)) {
			let end = start + this.literal.length;
			if (reader.string.substring(start, end) === this.literal) {
				reader.cursor = end;
				if (!reader.canReadAnything || reader.peek() === ' ') {
					return end;
				} else {
					reader.cursor = start;
				}
			}
		}
		return -1;
	}

	async listSuggestions(_context: CommandContext<S>, builder: SuggestionsBuilder): Promise<Suggestions> {
		if (this.literal.toLowerCase().startsWith(builder.remaining.toLowerCase())) {
			return builder.suggest(this.literal, null).build();
		} else {
			return Suggestions.empty;
		}
	}

	isValidInput(input: string): boolean {
		return this._parse(new StringReader(input)) > -1;
	}

	equals(other: CommandNode<S>): boolean {
		if (this === other) return true;
		if (!(other instanceof LiteralCommandNode)) return false;
		if (this.literal !== other.literal) return false;
		return super.equals(other);
	}

	get usage() {
		return this.literal;
	}

	createBuilder() {
		let builder: LiteralArgumentBuilder<S> = LiteralArgumentBuilder.literal(this.literal);
		builder.requires(this.requirement);
		builder.forward(this.redirect, this.modifier, this.forks);
		if (this.command !== null) {
			builder.executes(this.command);
		}
		return builder;
	}

	get sortedKey() {
		return this.literal;
	}

	get examples() {
		return [this.literal];
	}

	toString() {
		return `<literal ${this.literal}>`;
	}
}

export class RootCommandNode<S> extends CommandNode<S> {
	constructor() {
		super(null, () => false, null, s => [s.source], false);
	}
	get name() {
		return '';
	}
	get usage() {
		return '';
	}
	parse() { };
	async listSuggestions(): Promise<Suggestions> {
		return Suggestions.empty;
	}
	isValidInput() {
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
		public readonly customSuggestions: SuggestionProvider<S>,
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

	parse(reader: StringReader, contextBuilder: CommandContextBuilder<S>) {
		let start = reader.cursor;
		let parsed = {
			range: StringRange.between(start, reader.cursor),
			result: this.type.parse(reader),
		};

		contextBuilder.withArgument(this.name, parsed);
		contextBuilder.withNode(this, parsed.range);
	}

	async listSuggestions(ctx: CommandContext<S>, builder: SuggestionsBuilder): Promise<Suggestions> {
		if (this.customSuggestions) {
			return this.customSuggestions(ctx, builder);
		} else {
			return this.type.listSuggestions(ctx, builder);
		}
	}

	createBuilder(): RequiredArgumentBuilder<S, T> {
		let builder: RequiredArgumentBuilder<S, T> = RequiredArgumentBuilder.argument(this.name, this.type);
		builder.requires(this.requirement);
		builder.forward(this.redirect, this.modifier, this.forks);
		builder.suggests(this.customSuggestions);
		if (this.command !== null) {
			builder.executes(this.command);
		}
		return builder;
	}

	isValidInput(input: string) {
		try {
			let reader = new StringReader(input);
			this.type.parse(reader);
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
