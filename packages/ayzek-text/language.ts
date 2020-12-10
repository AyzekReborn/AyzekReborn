export abstract class LanguageBase {
	constructor(public name: string) {
		this.name = name.toLowerCase();
	}
	abstract get possiblePluralForms(): number[];
	/**
	 * Chinese = In rare cases where plural form introduces difference in personal pronoun (such as her vs. they, we vs. I), the plural form is different;
	 */
	defaultPluralForm?: number;
	abstract pluralForm(number: number): number;
}

export const LANGUAGES: { [key: string]: LanguageBase } = {};

function defineLanguage(language: LanguageBase) {
	LANGUAGES[language.name] = language;
}

const RUSSIAN_POSSIBLE_PLURAL_FORMS = [1, 2, 5];
const RUSSIAN_PLURAL_FORM = (n: number) => (n % 10 == 1 && n % 100 != 11 ? 1 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 2 : 5);

// Belorussian
defineLanguage(new class extends LanguageBase {
	constructor() {
		super('be');
	}
	possiblePluralForms = RUSSIAN_POSSIBLE_PLURAL_FORMS;
	pluralForm = RUSSIAN_PLURAL_FORM;
});

// Chinese
defineLanguage(new class extends LanguageBase {
	constructor() {
		super('ch');
	}
	possiblePluralForms = [1, 2];
	defaultPluralForm = 1;
	pluralForm(n: number): 1 | 2 {
		return n > 1 ? 2 : 1;
	}
});

// English
defineLanguage(new class extends LanguageBase {
	constructor() {
		super('en');
	}
	possiblePluralForms = [1, 2];
	pluralForm(number: number): 1 | 2 {
		return Math.abs(number) === 1 ? 1 : 2;
	}
});

// Russian
defineLanguage(new class extends LanguageBase {
	constructor() {
		super('ru');
	}
	possiblePluralForms = RUSSIAN_POSSIBLE_PLURAL_FORMS;
	pluralForm = RUSSIAN_PLURAL_FORM;
});

// Ukrainian
defineLanguage(new class extends LanguageBase {
	constructor() {
		super('uk');
	}
	possiblePluralForms = RUSSIAN_POSSIBLE_PLURAL_FORMS;
	pluralForm = RUSSIAN_PLURAL_FORM;
});
