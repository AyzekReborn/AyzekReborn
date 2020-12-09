
export class OpaqueTextPart {
	constructor(
		public opaqueType: symbol,
		public opaque: any,
		public fallback: Text,
	) { }
}

export function isOpaquePart(t: TextPart): t is OpaqueTextPart {
	return t instanceof OpaqueTextPart;
}

export function castOpaquePart(t: OpaqueTextPart, neededOpaqueType: symbol): any | null {
	if (!isOpaquePart(t)) return null;
	if (t.opaqueType !== neededOpaqueType) return null;
	return t.opaque as any;
}

export type FormattingDesc = {
	bold?: boolean,
	underlined?: boolean,
	color?: string,
	preserveMultipleSpaces?: boolean,
	italic?: boolean,
}
export class FormattingTextPart {
	constructor(public text: Text, public desc: FormattingDesc) { }
}
export class CodeTextPart {
	constructor(public lang: string, public data: string) { }
}
export class HashTagTextPart {
	constructor(public tags: string[], public hideOnNoSupport = false) { }
}

export type TextPart =
	undefined | null | string | number
	| OpaqueTextPart
	| CodeTextPart | FormattingTextPart
	| HashTagTextPart | Array<Text> | Component | Preformatted;
export type Text = TextPart;

export function joinText(joiner: Text, arr: Text[]): Text[] {
	return arr.flatMap((e: any, index: number) => index ? [joiner, e] : [e]);
}

export type Formatter = (strings: TemplateStringsArray, ...format: Text[]) => Text;
export function wrappedText(wrapper: (input: Text) => Text): Formatter {
	return (strings, ...format) => wrapper(strings.flatMap((e, index) => index ? [format[index - 1], e] : [e]));
}
export const text = wrappedText(t => t);
export const formattedText = (f: FormattingDesc) => wrappedText(t => new FormattingTextPart(t, f));

