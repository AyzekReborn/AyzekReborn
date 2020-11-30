import { Chat } from '@ayzek/core/conversation';
import { Text } from '@ayzek/text';
import Random from '@meteor-it/random';

abstract class Variant {
	abstract getValue(random: Random, chat: Chat): Text;
}

export class RandomItemVariant extends Variant {
	constructor(public variants: (Text | Variant)[]) {
		super();
	}
	getValue(random: Random, chat: Chat): Text {
		const value = random.randomArrayElement(this.variants);
		if (value instanceof Variant) {
			return value.getValue(random, chat);
		}
		return value;
	}
}

export class ListVariant extends Variant {
	constructor(public items: (Text | Variant)[]) {
		super();
	}
	getValue(random: Random, chat: Chat): Text {
		return this.items.map(item => {
			if (item instanceof Variant) {
				return item.getValue(random, chat);
			}
			return item;
		});
	}
}

export class RandomUserVariant extends Variant {
	constructor() {
		super();
	}
	getValue(random: Random, chat: Chat): Text {
		return random.randomArrayElement(chat.users.map(e => e.fullName));
	}
}
