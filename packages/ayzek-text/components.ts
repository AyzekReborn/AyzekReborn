import type { AbstractSlots } from '@ayzek/linguist';
import Random from '@meteor-it/random';
import type { Locale, Text, TextPart } from '.';
import { Component, ListComponent, Slots, StringComponent } from './component';

export class RandomComponent extends Component {
	seedSlot?: number;
	components: Component[] = [];

	setNamedSlot(name: string, slot: number) {
		if (name === 'seed') {
			this.seedSlot = slot;
			return;
		}
		super.setNamedSlot(name, slot);
	}

	setComponent(component: Component) {
		this.components.push(component);
	}

	validate() {
		if (this.components.length === 0) {
			throw new Error('random component requires at least one component to be set');
		}
	}

	localize(locale: Locale, slots: Slots): Text {
		const seed = this.seedSlot != undefined && slots[this.seedSlot];
		if (typeof seed !== 'string') {
			throw new Error('seed should be string!');
		}
		const random = new Random(seed);
		return random.randomArrayElement(this.components).localize(locale, slots);
	}
}

export class TrimWhitespace extends Component {
	children?: ListComponent;
	setChildren(children: ListComponent) {
		this.children = new ListComponent(children.list.map(i => {
			if (i instanceof StringComponent) {
				return new StringComponent(i.string.trim());
			} else {
				return i;
			}
		}));
	}

	validate() {
		if (this.children === undefined) {
			throw new Error('trim whitespace requires children to be set');
		}
	}

	localize(locale: Locale, slots: AbstractSlots<TextPart>): TextPart {
		return this.children!.localize(locale, slots);
	}
}
