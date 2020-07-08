export type OpaqueTextPart = {
	type: 'opaque',
	opaqueType: symbol,
	opaque: any,
	fallback: Text,
};

export function isOpaquePart(t: TextPart): t is OpaqueTextPart {
	return typeof t === 'object' && !(t instanceof Array) && t?.type === 'opaque';
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
export type FormattingTextPart = {
	type: 'formatting',
	data: Text,
} & FormattingDesc;
export type CodeTextPart = {
	type: 'code',
	lang: string,
	data: string,
}
export type HashTagTextPart = {
	type: 'hashTagPart',
	data: Text,
	hideOnNoSupport?: boolean
}

type ArrayTextPart = Array<TextPart>
export type TextPart =
	undefined | null | string | number
	| OpaqueTextPart
	| CodeTextPart | FormattingTextPart
	| HashTagTextPart | ArrayTextPart;
export type Text = TextPart;

export function joinText(joiner: Text, arr: Text[]): Text[] {
	return arr.flatMap((e: any, index: number) => index ? [joiner, e] : [e]);
}

export type Formatter = (strings: TemplateStringsArray, ...format: Text[]) => Text;
export function wrappedText(wrapper: (input: Text) => Text): Formatter {
	return (strings, ...format) => wrapper(strings.flatMap((e, index) => index ? [format[index - 1], e] : [e]));
}
export const text = wrappedText(t => t);
export const formattedText = (f: FormattingDesc) => wrappedText(t => ({
	type: 'formatting',
	...f,
	data: t,
} as FormattingTextPart));
