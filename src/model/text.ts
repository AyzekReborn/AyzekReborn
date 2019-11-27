import StringReader from "../command/reader";
import { Api } from "./api";
import { Chat, User } from "./conversation";

export type MentionTextPart<A extends Api<A>> = {
	type: 'mentionPart',
	data: User<A>,
	text?: string,
	// VK behavior: if one of all mentions have notification = true, then
	// all mentions have notification
	notification?: boolean,
}
export type ChatReferenceTextPart<A extends Api<A>> = {
	type: 'chatRefPart',
	data: Chat<A>,
	text?: string,
};
export type UnderlinedTextPart<A extends Api<A>> = {
	type: 'underlinedPart',
	data: Text<A>,
}
export type CodeTextPart<A extends Api<A>> = {
	type: 'code',
	data: Text<A>,
}
export type PreservingWhitespaceTextPart<A extends Api<A>> = {
	type: 'preservingWhitespace',
	data: Text<A>,
}
export type BoldTextPart<A extends Api<A>> = {
	type: 'boldPart',
	data: Text<A>,
}
export type HashTagTextPart<A extends Api<A>> = {
	type: 'hashTagPart',
	data: Text<A>,
	hideOnNoSupport?: boolean
}
export type TextPart<A extends Api<A>> = undefined | null | string | MentionTextPart<A> | ChatReferenceTextPart<A> | UnderlinedTextPart<A> | StringReader | TextPartArray<A> | CodeTextPart<A> | PreservingWhitespaceTextPart<A> | BoldTextPart<A> | HashTagTextPart<A>;
interface TextPartArray<A extends Api<A>> extends Array<TextPart<A>> { }
export type Text<A extends Api<A>> = TextPart<A>;

export function textJoin<A extends Api<A>>(arr: Text<A>[], joiner: Text<A>): Text<any>[] {
	return arr.flatMap((e: any, index: number) => index ? [joiner, e] : [e])
}
