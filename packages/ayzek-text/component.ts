import { AbstractComponent, AbstractParsingData, AbstractSlots, FundamentalListComponent, FundamentalSlotComponent, FundamentalStringComponent } from '@ayzek/linguist';
import { Translation, Text, TextPart, FormattingTextPart } from '.';
import { Preformatted } from './translation';

type Slot = string | Text;
export type Slots = AbstractSlots<Slot>;

export abstract class Component extends AbstractComponent<Translation, Slot, Text> {
	constructor() { super(); }
}

export class StringComponent extends FundamentalStringComponent<Slot, Text> {
	localize(_locale: any, _slots: Slots): TextPart {
		return this.string;
	}
}

export class ListComponent extends FundamentalListComponent<Translation, Slot, Text>{
	localize(locale: Translation, slots: Slots): TextPart {
		return this.list.map(i => i.localize(locale, slots));
	}
}

export class SlotComponent extends FundamentalSlotComponent<Translation, Slot, Text> {
	localize(locale: Translation, slots: Slots): TextPart {
		if (this.slot > slots.length) {
			throw new Error(`slot ${this.slot} is not set!`);
		}
		const slotValue = slots[this.slot];
		if (slotValue instanceof Component) {
			return slotValue.localize(locale, []);
		} else if (slotValue instanceof Preformatted) {
			return slotValue.localize(locale);
		}
		return slotValue;
	}
}

class NoopComponent extends AbstractComponent<Translation, Slot, Text> {
	setNamedSlot(_name: string, _slot: number) { }
	localize(_locale: Translation, _slots: AbstractSlots<TextPart>): TextPart {
		return [];
	}
}

class CodeComponent extends Component {
	children!: ListComponent;
	setChildren(children: ListComponent): void {
		this.children = children;
	}
	validate(): void {
		if (this.children === undefined)
			throw new Error('children is required in code');
	}
	localize(locale: Translation, slots: AbstractSlots<Slot>): TextPart {
		return new FormattingTextPart(this.children.localize(locale, slots), { preserveMultipleSpaces: true });
	}
}

export class ParsingData extends AbstractParsingData<Translation, Slot, Text> {
	components: { [key: string]: new () => Component } = Object.create(null);
	defineComponent(name: string, component: new () => Component) {
		this.components[name] = component;
	}
	undefineComponent(name: string) {
		delete this.components[name];
	}

	fundamentalString(string: string) {
		return new StringComponent(string);
	}
	fundamentalList(list: Component[]) {
		return new ListComponent(list);
	}
	fundamentalSlot(slot: number) {
		return new SlotComponent(slot);
	}

	componentByName(name: string): Component {
		if (name === 'noop') {
			return new NoopComponent();
		} else if (name === 'code') {
			return new CodeComponent();
		}
		if (this.components[name]) {
			return new this.components[name]();
		}
		throw new Error(`component not defined: ${name}`);
	}
}
