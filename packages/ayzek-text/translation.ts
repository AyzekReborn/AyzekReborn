import { parseComponent } from '@ayzek/linguist';
import type { CT, T, Text, Translation } from '.';
import type { Component, ParsingData, Slots } from './component';

abstract class Translator {
	abstract translate(context: string, input: string): Component;
}

class DefaultTranslator extends Translator {
	_data?: ParsingData;

	get data(): ParsingData {
		if (!this._data) {
			throw new Error('parsing data should be set after load');
		}
		return this._data;
	}

	constructor() {
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

class OtherTranslator extends Translator {
	translated: Map<string, Map<string, Component>> = new Map();
	constructor(public defaultTranslation: DefaultTranslator, translation: { [key: string]: { [key: string]: string } }) {
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


export class TranslatorStorage {
	default: DefaultTranslator = new DefaultTranslator();
	translations: { [key: string]: OtherTranslator } = {};
	set parsingData(data: ParsingData) {
		this.default._data = data;
	}

	define(translation: string, data: { [key: string]: { [key: string]: string } }) {
		if (this.translations[translation]) {
			throw new Error(`translation is already defined: ${translation}`);
		}
		this.translations[translation] = new OtherTranslator(this.default, data);
	}
	translator(translation: string): Translator {
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
	constructor(private base: TranslatorStorage, private context: string, private input: string, private slots: Slots) { }
	localize(locale: Translation): Text {
		return this.base.translator(locale.language.name).translate(this.context, this.input).localize(locale, this.slots);
	}

	get id(): string {
		return this.context + '.' + this.input;
	}
}
