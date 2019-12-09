import { CommandSyntaxError, ExpectedSomethingError } from "./error";

export enum Type {
	INT = 'integer',
	FLOAT = 'float',
	BOOLEAN = 'boolean',
	QUOTED = 'quoted string',
	UNQUOUTED = 'unquoted string',
	STRING = 'string',
	AMOUNT = 'amount'
}
export enum MissingCharType {
	QUOTE = 'quote'
}

export class InvalidCursorPositionError extends Error {
	constructor(public readonly reader: StringReader, public newPosition: number) {
		super();
		this.name = 'InvalidCursorPositionError';
	}
}

export class ExpectedError extends ExpectedSomethingError {
	constructor(public readonly reader: StringReader, public readonly type: Type) {
		super(reader, type);
		this.name = 'ExpectedError';
	}
}

export class BadValueError<T> extends CommandSyntaxError {
	constructor(public readonly reader: StringReader, public readonly type: Type, public readonly value: T) {
		super(reader, `Bad value for ${type}: ${value}`);
		this.name = 'BadValueError';
	}
}
export class MissingChar<T> extends CommandSyntaxError {
	constructor(public readonly reader: StringReader, public readonly type: Type, public readonly missingType: MissingCharType, public readonly char: T) {
		super(reader, `Missing ${missingType} (${char}) in ${type}`);
		this.name = 'MissingChar';
	}
}
export default class StringReader {
	clone(): StringReader {
		let reader = new StringReader(this.string);
		reader.cursor = this.cursor;
		return reader;
	}
	private _cursor: number = 0;
	get cursor() {
		return this._cursor;
	}
	set cursor(newValue: number) {
		if (newValue > this.string.length || newValue < 0)
			throw new InvalidCursorPositionError(this, newValue);
		this._cursor = newValue;
	}
	constructor(public string: string) { }
	get remainingLength() {
		return this.string.length - this.cursor;
	}
	get totalLength() {
		return this.string.length;
	}
	get read() {
		return this.string.substring(0, this.cursor);
	}
	get remaining() {
		return this.string.substring(this.cursor);
	}
	canRead(length: number) {
		return this.cursor + length <= this.string.length;
	}
	get canReadAnything() {
		return this.canRead(1);
	}
	peek() {
		return this.peekAt(0);
	}
	peekAt(offset: number) {
		return this.string.charAt(this.cursor + offset);
	}
	readChar() {
		return this.string.charAt(this.cursor++);
	}
	readChars(count: number) {
		const str = this.string.slice(this.cursor, this.cursor + count);
		this.cursor += count;
		return str;
	}
	skip() {
		this.cursor++;
	}
	skipMulti(count: number) {
		this.cursor += count;
	}
	skipWhitespace() {
		while (this.canReadAnything && /\s/.test(this.peek())) {
			this.skip();
		}
	}
	static isNumberChar(char: string) {
		return /[0-9.,-]/.test(char);
	}
	readBeforeTestFails(test: (char: string) => boolean) {
		let start = this.cursor;
		while (this.canReadAnything && test(this.peek())) {
			this.skip();
		}
		return this.string.substring(start, this.cursor);
	}
	static isEscape(char: string) {
		return /\\/.test(char);
	}

	private readBeforeTestFailsWithEscapes(test: (char: string) => boolean) {
		let inEscape = false;
		return this.readBeforeTestFails(char => {
			if (inEscape) {
				inEscape = false;
				return true;
			}
			if (StringReader.isEscape(char)) {
				inEscape = true;
				return true;
			} else {
				return test(char);
			}
		})
	}
	private regexpTerminatorReplaceCache: { [key: string]: RegExp } = {};
	public readBeforeTerminatorWithEscapes(char: string) {
		if (char.length !== 1) throw new Error('Expected single character');
		let got = this.readBeforeTestFailsWithEscapes(t => t !== char);
		if (!this.regexpTerminatorReplaceCache[char])
			this.regexpTerminatorReplaceCache[char] = new RegExp(`\\${char}`, 'g');
		return got.replace(this.regexpTerminatorReplaceCache[char], char).replace(/\\\\/g, '\\');
	}
	private readNumber(int: boolean) {
		let got = this.readBeforeTestFails(StringReader.isNumberChar);
		if (got.length === 0) throw new ExpectedError(this, int ? Type.INT : Type.FLOAT);
		if (int && /[.,]/.test(got)) {
			throw new BadValueError(this, Type.INT, got);
		}
		got = got.replace(',', '.')
		if (!int && got.indexOf('.') !== got.lastIndexOf('.'))
			throw new BadValueError(this, Type.FLOAT, got);
		let value = int ? parseInt(got, 10) : parseFloat(got);
		if (isNaN(value))
			throw new BadValueError(this, int ? Type.INT : Type.FLOAT, got);
		return value;
	}
	readInt() {
		return this.readNumber(true);
	}
	readFloat() {
		return this.readNumber(false);
	}
	static isUnquotedStringChar(char: string) {
		return !/\s/.test(char);
	}
	readUnquotedString(): string {
		if (!this.canReadAnything) throw new ExpectedError(this, Type.UNQUOUTED);
		return this.readBeforeTestFails(StringReader.isUnquotedStringChar);
	}
	static isQuote(char: string) {
		return /['"]/.test(char);
	}
	readQuotedString(): string {
		if (!this.canReadAnything) throw new ExpectedError(this, Type.QUOTED);
		let quoteChar = this.peek();
		if (!StringReader.isQuote(quoteChar)) throw new ExpectedError(this, Type.QUOTED);
		let start = this.cursor;
		this.skip();
		let value = this.readBeforeTerminatorWithEscapes(quoteChar);
		if (this.peek() !== quoteChar) {
			this.cursor = start;
			throw new MissingChar(this, Type.QUOTED, MissingCharType.QUOTE, quoteChar)
		}
		this.skip();
		return value;
	}
	readString(): string {
		if (!this.canReadAnything) throw new ExpectedError(this, Type.STRING);
		let char = this.peek();
		if (StringReader.isQuote(char)) {
			return this.readQuotedString();
		} else {
			return this.readUnquotedString();
		}
	}
	readBoolean(): boolean {
		if (!this.canReadAnything) throw new ExpectedError(this, Type.BOOLEAN);
		let start = this.cursor;
		let value = this.readString().toLowerCase();
		if (value === 'true') {
			return true;
		} else if (value === 'false') {
			return false;
		} else {
			this.cursor = start;
			throw new BadValueError(this, Type.BOOLEAN, value);
		}
	}
	toString() {
		return this.toStringWithCursor('|');
	}
	toStringWithCursor(cursor: string) {
		return `${this.string.substring(0, this.cursor)}${cursor}${this.string.substring(this.cursor)}`
	}
}
