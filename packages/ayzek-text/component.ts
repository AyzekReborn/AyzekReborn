import { AbstractComponent, AbstractParsingData, AbstractSlots, FundamentalListComponent, FundamentalSlotComponent, FundamentalStringComponent } from '@ayzek/linguist';
import type { Locale, Text, TextPart } from '.';
import { Preformatted } from './translation';

type Slot = string | Text;
export type Slots = AbstractSlots<Slot>;

export abstract class Component extends AbstractComponent<Locale, Slot, Text> {
	constructor() { super(); }
}

export class StringComponent extends FundamentalStringComponent<Slot, Text> {
	localize(_locale: any, _slots: Slots): TextPart {
		return this.string;
	}
}

export class ListComponent extends FundamentalListComponent<Locale, Slot, Text>{
	localize(locale: Locale, slots: Slots): TextPart {
		return this.list.map(i => i.localize(locale, slots));
	}
}

export class SlotComponent extends FundamentalSlotComponent<Locale, Slot, Text> {
	localize(locale: Locale, slots: Slots): TextPart {
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

class NoopComponent extends AbstractComponent<Locale, Slot, Text> {
	setNamedSlot(_name: string, _slot: number) { }
	localize(_locale: Locale, _slots: AbstractSlots<TextPart>): TextPart {
		return [];
	}
}

export class ParsingData extends AbstractParsingData<Locale, Slot, Text> {
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
		}
		throw new Error(`component not defined: ${name}`);
	}
}
