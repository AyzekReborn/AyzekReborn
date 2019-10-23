export default class StringRange {
	constructor(public readonly start: number, public readonly end: number) {
		if (start > end) throw new Error(`Start > end for (${start}, ${end})`)
	}
	static at(pos: number) {
		return new StringRange(pos, pos);
	}
	static between(start: number, end: number) {
		return new StringRange(start, end);
	}
	static encompassing(a: StringRange, b: StringRange) {
		return new StringRange(Math.min(a.start, b.start), Math.max(a.end, b.end));
	}
	get(string: string) {
		return string.substring(this.start, this.end);
	}
	get isEmpty() {
		return this.start === this.end;
	}
	get length() {
		return this.end - this.start;
	}
	equals(other: StringRange) {
		return this.start === other.start && this.end === other.end;
	}
	toString() {
		return `(${this.start}, ${this.end})`;
	}
}
