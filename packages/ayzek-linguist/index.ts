
export type AbstractSlots<S> = S[];

export abstract class AbstractComponent<L, S, T> {
	abstract localize(locale: L, slots: AbstractSlots<S>): T;

	/**
	 * component{1}
	 */
	setSlot(_slot: number) {
		throw new Error('default slot is not defined!');
	}
	/**
	 * component.name{1}
	 */
	setNamedSlot(name: string, _slot: number) {
		throw new Error(`named slot "${name}" is not defined!`);
	}

	/**
	 * component{other-component}
	 */
	setComponent(_component: AbstractComponent<L, S, T>) {
		throw new Error('default component is not defined!');
	}
	/**
	 * component.name{other-component}
	 */
	setNamedComponent(name: string, _component: AbstractComponent<L, S, T>) {
		throw new Error(`named component "${name}" is not defined`);
	}

	/**
	 * component'value'
	 */
	setValue(_value: string) {
		throw new Error('default value is not defined');
	}
	/**
	 * component.name'value'
	 */
	setNamedValue(name: string, _value: string) {
		throw new Error(`named value "${name}" is not defined`);
	}

	/**
	 * component;children
	 */
	setChildren(_children: FundamentalListComponent<L, S, T>) {
		throw new Error('children is not defined');
	}

	/**
	 * Called on end of component parsing, should throw if some of required properties is not set
	 */
	validate() { }
}
export abstract class FundamentalStringComponent<S, T> extends AbstractComponent<any, S, T> {
	constructor(public string: string) { super(); }
}
export abstract class FundamentalListComponent<L, S, T> extends AbstractComponent<L, S, T> {
	constructor(public list: AbstractComponent<L, S, T>[]) { super(); }
}
export abstract class FundamentalSlotComponent<L, S, T> extends AbstractComponent<L, S, T> {
	constructor(public slot: number) { super(); }
}

function readUntil(input: string, until: string[]): [string, string] {
	let idx = 0;
	while (idx < input.length && !until.includes(input[idx])) {
		idx++;
	}
	return [input.slice(0, idx), input.slice(idx)];
}
function readUntilTrue(input: string, until: (char: string) => boolean): [string, string] {
	let idx = 0;
	while (idx < input.length && until(input[idx])) {
		idx++;
	}
	return [input.slice(0, idx), input.slice(idx)];
}

export abstract class AbstractParsingData<L, S, T> {
	abstract fundamentalString(string: string): FundamentalStringComponent<S, T>;
	abstract fundamentalList(items: AbstractComponent<L, S, T>[]): FundamentalListComponent<L, S, T>;
	abstract fundamentalSlot(slot: number): FundamentalSlotComponent<L, S, T>;

	abstract componentByName(name: string): AbstractComponent<L, S, T>;
}

class ParsingState {
	lastSlot = 0;
	nextSlot() {
		return this.lastSlot++;
	}
}

function readName(input: string): [string, string] {
	return readUntil(input, [' ', '.', '{', '}', ';']);
}
function isDigit(char: string): boolean {
	return '0123456789'.includes(char) && char.length === 1;
}
function readNumber(input: string): [number, string] {
	let num: string;
	[num, input] = readUntilTrue(input, isDigit);
	if (num.length === 0) {
		throw new Error('missing number');
	}
	return [parseInt(num, 10), input];
}

function readComponent<L, S, T>(input: string, state: ParsingState, data: AbstractParsingData<L, S, T>): [AbstractComponent<L, S, T>, string] {
	let name: string;
	if (input[0] === '}') {
		return [data.fundamentalSlot(state.nextSlot()), input];
	} else if (isDigit(input[0])) {
		let num: number;
		[num, input] = readNumber(input);
		if (num < 1) {
			throw new Error('slot numbers should begin with 1!');
		}
		return [data.fundamentalSlot(num - 1), input];
	} else if (input[0] === '#') {
		return readComponents(input.slice(1), state, data);
	}

	[name, input] = readName(input);

	const component = data.componentByName(name);

	let currentProperty: string | undefined = undefined;
	let componentValue: AbstractComponent<L, S, T>;
	let children: FundamentalListComponent<L, S, T>;
	let value: string;
	props: while (input.length !== 0) {
		switch (input[0]) {
			case '.':
				[currentProperty, input] = readName(input.slice(1));
				if (currentProperty.length === 0) {
					throw new Error('missing property name');
				}
				break;
			case '{':
				input = input.slice(1);
				[componentValue, input] = readComponent(input, state, data);
				if (input.length === 0 || input[0] !== '}') {
					throw new Error('component invocation should end with "}"!');
				}
				input = input.slice(1);
				if (componentValue instanceof FundamentalSlotComponent) {
					const slot = componentValue.slot;
					if (currentProperty) {
						component.setNamedSlot(currentProperty, slot);
					} else {
						component.setSlot(slot);
					}
				} else if (currentProperty) {
					component.setNamedComponent(currentProperty, componentValue);
				} else {
					component.setComponent(componentValue);
				}
				break;
			case "'":
				input = input.slice(1);
				if (input.length === 0) {
					throw new Error('missing value');
				}
				[value, input] = readUntil(input, ["'"]);
				if (input.length === 0) {
					throw new Error('value should end with "\'"!');
				}
				input = input.slice(1);
				if (currentProperty) {
					component.setNamedValue(currentProperty, value);
				} else {
					component.setValue(value);
				}
				break;
			case ' ':
			case ';':
				input = input.slice(1);
				[children, input] = readComponents(input, state, data);
				if (input.length === 0 || input[0] !== '}') {
					throw new Error('children should end with "}"!');
				}
				input = input.slice(1);
				component.setChildren(children);
				break props;
			case '}':
				break props;
		}
	}
	component.validate();
	return [component, input];
}

function readComponents<L, S, T>(input: string, state: ParsingState, data: AbstractParsingData<L, S, T>): [FundamentalListComponent<L, S, T>, string] {
	const out: AbstractComponent<L, S, T>[] = [];
	while (true) {
		let text: string;
		[text, input] = readUntil(input, ['{', '}']);
		if (text.length > 0) {
			out.push(data.fundamentalString(text));
		}
		if (input.length === 0 || input[0] === '}') {
			return [data.fundamentalList(out), input];
		} else {
			let component: AbstractComponent<L, S, T>;
			[component, input] = readComponent(input.slice(1), state, data);
			if (input.length === 0 || input[0] !== '}') {
				throw new Error('component invocation should end with "}"!');
			}
			input = input.slice(1);
			out.push(component);
		}
	}
}

export function parseComponent<L, S, T>(input: string, data: AbstractParsingData<L, S, T>): AbstractComponent<L, S, T> {
	let component: AbstractComponent<L, S, T>;
	[component, input] = readComponents(input, new ParsingState(), data);
	if (input.length !== 0) {
		throw new Error(`input left after parsing: "${input}"`);
	}
	return component;
}
