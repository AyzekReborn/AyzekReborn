import { Api } from "./api";
import { Chat, User } from "./conversation";

export type MentionTextPart<A extends Api<A>> = {
	type: 'mentionPart',
	data: User<A>,
	text?: string,
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
export type TextPart<A extends Api<A>> = string | MentionTextPart<A> | ChatReferenceTextPart<A> | UnderlinedTextPart<A>;
export type Text<A extends Api<A>> = TextPart<A> | TextPart<A>[];
