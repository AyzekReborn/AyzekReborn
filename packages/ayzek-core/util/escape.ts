/**
 * Returns any character from private use area (basic multilingual plane),
 * which isn't used in string
 * @param str
 */
export function chooseCharacter(str: string): string {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const ch = String.fromCharCode(Math.random() * 6399 | 0 + 57344);
		if (str.indexOf(ch) === -1)
			return ch;
	}
}

export type StringEscapeData = {
	char: string,
	replaced: string[],
};

/**
 * Replaces string parts with reserved character
 */
export function escapeStringParts(str: string, regexp: RegExp): [string, StringEscapeData] {
	const replaced: string[] = [];
	const char = chooseCharacter(str);
	return [
		str.replace(regexp, e => {
			replaced.push(e);
			return char;
		}),
		{
			char,
			replaced,
		},
	];
}

export function replaceBack(str: string, data: StringEscapeData) {
	let i = 0;
	return str.replace(new RegExp(data.char, 'g'), () => {
		return data.replaced[i++];
	});
}

export function replaceBut(str: string, what: RegExp, but: RegExp, relaceWith: string) {
	let [tmp, data] = escapeStringParts(str, but);
	tmp = tmp.replace(what, relaceWith);
	return replaceBack(tmp, data);
}
