export type OpaqueTextPart = {
	type: 'opaque',
	opaqueType: Symbol,
	opaque: any
};

export function isOpaquePart(t: TextPart): t is OpaqueTextPart {
	return typeof t === 'object' && !(t instanceof Array) && t?.type === 'opaque';
}

export function castOpaquePart(t: OpaqueTextPart, neededOpaqueType: Symbol): any | null {
	if (!isOpaquePart(t)) return null;
	if (t.opaqueType !== neededOpaqueType) return null;
	return t.opaque as any;
}

export type FormattingTextPart = {
	type: 'formatting',
	bold?: boolean,
	underlined?: boolean,
	color?: string,
	preserveMultipleSpaces?: boolean,
	italic?: boolean,
	data: Text,
}
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

interface ArrayTextPart extends Array<TextPart> { }
export type TextPart =
	undefined | null | string | number
	| OpaqueTextPart
	| CodeTextPart | FormattingTextPart
	| HashTagTextPart | ArrayTextPart;
export type Text = TextPart;

export function joinText(joiner: Text, ...arr: Text[]): Text[] {
	return arr.flatMap((e: any, index: number) => index ? [joiner, e] : [e])
}
