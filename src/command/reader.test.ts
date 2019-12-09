import StringReader, { InvalidCursorPositionError } from './reader';

describe('Reader', () => {
	it('should correctly clone', () => {
		const original = new StringReader('test 123123');
		original.cursor = 8;
		const cloned = original.clone();
		expect(original).not.toBe(cloned);
		expect(original).toEqual(cloned);
	});
	it('should throw on incorrect cursor position', () => {
		const reader = new StringReader('hello');
		expect(() => {
			reader.cursor = -1;
		}).toThrow(new InvalidCursorPositionError(reader, -1));
		expect(() => {
			reader.cursor = 7;
		}).toThrow(new InvalidCursorPositionError(reader, 7));
		expect(() => {
			reader.skipMulti(10);
		}).toThrow(new InvalidCursorPositionError(reader, 10));
	});
	it('should should correctly do cursor manipilations', () => {
		let reader = new StringReader('ab');
		expect(reader.peek()).toBe('a');
		expect(reader.cursor).toBe(0);
		expect(reader.read).toBe('');
		expect(reader.remainingLength).toBe(2);
		expect(reader.remaining).toBe('ab');
		expect(reader.totalLength).toBe(2);
		reader.skip();
		expect(reader.peek()).toBe('b');
		expect(reader.cursor).toBe(1);
		expect(reader.read).toBe('a');
		expect(reader.remainingLength).toBe(1);
		expect(reader.remaining).toBe('b');
		expect(reader.totalLength).toBe(2);
		reader.skip();
	});
	it('should correctly peek', () => {
		let reader = new StringReader('a  b c');
		expect(reader.peek()).toBe('a');
		expect(reader.peekAt(1)).toBe(' ');
	});
	it('should correctly skip whitespace and read signe chars', () => {
		let reader = new StringReader('a     b');
		expect(reader.readChar()).toBe('a');
		reader.skipWhitespace();
		expect(reader.readChar()).toBe('b');
	});
	it('should read int', () => {
		let reader = new StringReader('23123 -222 22.2');
		expect(reader.readInt()).toEqual(23123);
		reader.skip();
		expect(reader.readInt()).toBe(-222);
		reader.skip();
		expect(() => reader.readInt()).toThrow();
	});
	it('should fail on parseInt error', () => {
		let reader = new StringReader('--22');
		expect(() => reader.readInt()).toThrow();
	});
	it('should read float', () => {
		let reader = new StringReader('23123 -222 22.2 22..2');
		expect(reader.readFloat()).toEqual(23123);
		reader.skip();
		expect(reader.readFloat()).toBe(-222);
		reader.skip();
		expect(reader.readFloat()).toBe(22.2);
		reader.skip();
		expect(() => reader.readFloat()).toThrow();
	});
	it('should fail on parseFloat error', () => {
		let reader = new StringReader('--22');
		expect(() => reader.readFloat()).toThrow();
	});
	it('should throw on empty string being read as int or float', () => {
		let reader = new StringReader('');
		expect(() => reader.readInt()).toThrow();
		expect(() => reader.readFloat()).toThrow();
	});
	it('should read unquoted', () => {
		let reader = new StringReader('Hello world! "123 123"');
		expect(reader.readUnquotedString()).toBe('Hello');
		reader.skip();
		expect(reader.readUnquotedString()).toBe('world!');
		reader.skip();
		expect(reader.readUnquotedString()).toBe('"123');
		reader.skip();
		expect(reader.readUnquotedString()).toBe('123"');
	});
	it('should read quoted', () => {
		let reader = new StringReader('"Hello world!"');
		expect(reader.readQuotedString()).toBe('Hello world!');
		expect(reader.canReadAnything).toBe(false);
	});
	it('should quote read to fail on missing quoute', () => {
		let reader = new StringReader('"Hello world!');
		expect(() => reader.readQuotedString()).toThrow();
		expect(reader.remaining).toBe('"Hello world!');
	});
	it('should read escaped quotes', () => {
		let reader = new StringReader('"Hello world!\\" 123"');
		expect(reader.readQuotedString()).toBe('Hello world!\\" 123');
		expect(reader.canReadAnything).toBe(false);
	});
	it('should fail on bad quoute', () => {
		let reader = new StringReader('w');
		expect(() => reader.readQuotedString()).toThrow();
		expect(reader.remaining).toBe('w');
	});
	it('should read escaped escape sequences', () => {
		let reader = new StringReader('"Hello world!\\\\"');
		expect(reader.readQuotedString()).toBe('Hello world!\\');
		expect(reader.canReadAnything).toBe(false);
	});
	it('should read string', () => {
		let reader = new StringReader('Hello "Hello, world!"');
		expect(reader.readString()).toBe('Hello');
		reader.skip();
		expect(reader.readString()).toBe('Hello, world!');
	});
	it('should read boolean', () => {
		let reader = new StringReader('true false hello');
		expect(reader.readBoolean()).toBe(true);
		reader.skip();
		expect(reader.readBoolean()).toBe(false);
		reader.skip();
		expect(() => reader.readBoolean()).toThrow();
		expect(reader.readString()).toBe('hello');
	});
	it('should fail on bad calls', () => {
		let reader = new StringReader('');
		expect(() => reader.readBeforeTerminatorWithEscapes('')).toThrow();
		expect(() => reader.readBeforeTerminatorWithEscapes('  ')).toThrow();
		expect(() => reader.readQuotedString()).toThrow();
		expect(() => reader.readUnquotedString()).toThrow();
		expect(() => reader.readString()).toThrow();
		expect(() => reader.readBoolean()).toThrow();
	});
});
