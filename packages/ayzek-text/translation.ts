import { parseComponent } from '@ayzek/linguist';
import type { CT, Locale, T, Text } from '.';
import type { Component, ParsingData, Slots } from './component';

abstract class Translation {
	abstract translate(context: string, input: string): Component;
}

class DefaultTranslation extends Translation {
	constructor(public data: ParsingData) {
		super();
	}

	parseCache: Map<string, Map<string, Component>> = new Map();
	translate(context: string, input: string): Component {
		if (!this.parseCache.has(context)) {
			this.parseCache.set(context, new Map());
		}
		const cache = this.parseCache.get(context)!;
		if (!cache.has(input)) {
			cache.set(input, parseComponent(input, this.data));
		}
		return cache.get(input)!;
	}
}

class OtherTranslation extends Translation {
	translated: Map<string, Map<string, Component>> = new Map();
	constructor(public defaultTranslation: DefaultTranslation, translation: { [key: string]: { [key: string]: string } }) {
		super();
		for (const context of Object.getOwnPropertyNames(translation)) {
			const items = new Map();
			this.translated.set(context, items);
			for (const item of Object.getOwnPropertyNames(translation[context])) {
				try {
					items.set(item, parseComponent(translation[context][item], defaultTranslation.data));
				} catch (e) {
					console.log(`failed to parse translation ${context}.${item}: ${translation[context][item]}`);
					console.log(e.stack);
				}
			}
		}
	}
	fallbackTranslation(context: string, input: string): Component {
		return this.defaultTranslation.translate(context, input);
	}
	translate(context: string, input: string): Component {
		const translated = this.translated.get(context)?.get(input);
		if (!translated) {
			return this.fallbackTranslation(context, input);
		}
		return translated;
	}
}


export class TranslationStorage {
	default: DefaultTranslation;
	translations: { [key: string]: OtherTranslation } = {};
	constructor(parsingData: ParsingData) {
		this.default = new DefaultTranslation(parsingData);
	}
	define(translation: string, data: { [key: string]: { [key: string]: string } }) {
		if (this.translations[translation]) {
			throw new Error(`translation is already defined: ${translation}`);
		}
		this.translations[translation] = new OtherTranslation(this.default, data);
	}
	translation(translation: string): Translation {
		return this.translations[translation] ?? this.default;
	}
	ct: CT = context => {
		return (input, ...slots) => new Preformatted(this, context, joinWithSlotIds(input), slots);
	}
	t: T = (input, ...slots) => new Preformatted(this, '', joinWithSlotIds(input), slots);
}
function joinWithSlotIds(input: TemplateStringsArray): string {
	if (input.length === 0) {
		return '';
	} else if (input.length === 1) {
		return input[0];
	}
	const output = [input[0]];
	let idx = 1;
	for (const part of input.slice(1)) {
		output.push(`{${idx++}}`);
		output.push(part);
	}
	return output.join('');
}

export class Preformatted {
	constructor(private base: TranslationStorage, private context: string, private input: string, private slots: Slots) { }
	localize(locale: Locale): Text {
		return this.base.translation(locale.translation.name).translate(this.context, this.input).localize(locale, this.slots);
	}
}
