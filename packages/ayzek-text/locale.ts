export abstract class LocaleBase {
	constructor(public name: string) {
		this.name = name.toUpperCase();
	}

	abstract timeFormat: 12 | 24;
	abstract timeZone: string;
}

export const LOCALES: { [key: string]: LocaleBase } = {};

function defineLocale(translation: LocaleBase) {
	LOCALES[translation.name] = translation;
}

// Belarus
defineLocale(new class extends LocaleBase {
	constructor() {
		super('BY');
	}

	timeFormat: 24 = 24;
	timeZone = 'Europe/Minsk';
});

// China
defineLocale(new class extends LocaleBase {
	constructor() {
		super('CN');
	}

	timeFormat: 24 = 24;
	timeZone = 'Asia/Beijing';
});

// Russia
defineLocale(new class extends LocaleBase {
	constructor() {
		super('RU');
	}

	timeFormat: 24 = 24;
	timeZone = 'Europe/Moscow';
});

// USA
defineLocale(new class extends LocaleBase {
	constructor() {
		super('US');
	}

	timeFormat: 12 = 12;
	timeZone = 'America/New_York';
});

// Ukraine
defineLocale(new class extends LocaleBase {
	constructor() {
		super('UA');
	}

	timeFormat: 24 = 24;
	timeZone = 'Europe/Kyiv';
});
