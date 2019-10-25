import StringRange from "./range";
import { CommandNode } from './tree';
import { CommandContext } from "./command";

export class SuggestionContext<S> {
	constructor(public readonly parent: CommandNode<S>, public readonly startPos: number) { }
}

export class Suggestion {
	constructor(public readonly range: StringRange, public readonly text: string, public readonly tooltip: string | null) { }
	apply(input: string) {
		if (this.range.start === 0 && this.range.end === input.length)
			return input
		let result = '';
		if (this.range.start > 0)
			result += input.substring(0, this.range.start);
		result += this.text;
		if (this.range.end < input.length)
			result += input.substring(this.range.end);
		return result;
	}
	expand(command: string, range: StringRange) {
		if (range.equals(this.range))
			return this;
		let result = '';
		if (range.start < this.range.start)
			result += command.substring(range.start, this.range.start);
		result += this.text;
		if (range.end > this.range.end)
			result += command.substring(this.range.end, range.end);
		return new Suggestion(range, result, this.tooltip);
	}
}

const suggestionComparator = undefined;

export class Suggestions {
	constructor(public readonly range: StringRange, public readonly suggestions: Suggestion[]) {

	}
	get isEmpty() {
		return this.suggestions.length === 0;
	}
	static get empty(): Suggestions {
		return EMPTY_SUGGESTIONS;
	}
	static merge(command: string, input: Suggestions[]): Suggestions {
		if (input.length === 0) return EMPTY_SUGGESTIONS;
		if (input.length === 1) return input[0];
		let texts = new Set<Suggestion>();
		for (let suggestions of input) {
			for (let suggestion of suggestions.suggestions) {
				texts.add(suggestion);
			}
		}
		return Suggestions.create(command, Array.from(texts));
	}
	static create(command: string, suggestions: Suggestion[]) {
		if (suggestions.length === 0)
			return EMPTY_SUGGESTIONS;
		let start = Infinity;
		let end = -Infinity;
		for (let suggestion of suggestions) {
			start = Math.min(suggestion.range.start, start);
			end = Math.max(suggestion.range.end, end);
		}
		let range = new StringRange(start, end);
		let texts = new Set<Suggestion>();
		for (let suggestion of suggestions) {
			texts.add(suggestion.expand(command, range));
		}
		let sorted = Array.from(texts);
		sorted.sort(suggestionComparator);
		return new Suggestions(range, sorted);
	}
}
const EMPTY_SUGGESTIONS = new Suggestions(StringRange.at(0), []);

export class SuggestionsBuilder {
	readonly remaining: string;
	readonly result: Suggestion[] = [];
	constructor(public readonly input: string, public readonly start: number) {
		this.remaining = input.substring(start);
	}
	build() {
		return Suggestions.create(this.input, this.result);
	}
	suggest(text: string, tooltip: string | null): this {
		if (text === this.remaining) {
			return this;
		}
		this.result.push(new Suggestion(StringRange.between(this.start, this.input.length), text, tooltip));
		return this;
	}
	add(other: SuggestionsBuilder) {
		this.result.push(...other.result);
		return this;
	}
	createOffset(start: number) {
		return new SuggestionsBuilder(this.input, start);
	}
	restart() {
		return new SuggestionsBuilder(this.input, this.start);
	}
}

export type SuggestionProvider<S> = (ctx: CommandContext<S>, builder: SuggestionsBuilder) => Promise<Suggestions>;
