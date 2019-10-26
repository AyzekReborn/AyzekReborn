import { Api } from "./api";
import { Chat, User } from "./conversation";

export type MentionLinePart<A extends Api<A>> = {
	type: 'mentionPart',
	data: User<A>,
}
export type ChatReferenceLinePart<A extends Api<A>> = {
	type: 'chatRefPart',
	data: Chat<A>,
};
export type TextLinePart = {
	type: 'textPart',
	data: string,
};
export type UnderlinedPart<A extends Api<A>> = {
	type: 'underlinedPart',
	data: LinePart<A>,
}
export type LinePart<A extends Api<A>> = TextLinePart | MentionLinePart<A> | ChatReferenceLinePart<A> | UnderlinedPart<A>;
export type Line<A extends Api<A>> = {
	type: 'line',
	data: LinePart<A>[]
};
export type Text<A extends Api<A>> = string | Line<A>[];
