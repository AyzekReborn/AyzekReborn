import { Api } from "./api";
import { Chat, User } from "./conversation";
import StringReader from "../command/reader";

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
export type TextPart<A extends Api<A>> = undefined | null | string | MentionTextPart<A> | ChatReferenceTextPart<A> | UnderlinedTextPart<A> | StringReader | TextPartArray<A> | CodeTextPart<A> | PreservingWhitespaceTextPart<A>;
interface TextPartArray<A extends Api<A>> extends Array<TextPart<A>> { }
export type Text<A extends Api<A>> = TextPart<A>;

export function textJoin<A extends Api<A>>(arr: Text<A>[], joiner: Text<A>): Text<any>[] {
	// Wtf, ts doesn't provide typings for flatMap?
	return (arr as any).flatMap((e: any, index: number) => index ? [joiner, e] : [e])
}
