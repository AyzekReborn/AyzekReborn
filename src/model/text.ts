import { Api } from "./api";
import { Chat, User } from "./conversation";

export type MentionLinePart<A extends Api> = {
	type: 'mentionPart',
	data: User<A>,
}
export type ChatReferenceLinePart<A extends Api> = {
	type: 'chatRefPart',
	data: Chat<A>,
};
export type TextLinePart = {
	type: 'textPart',
	data: string,
};
export type UnderlinedPart<A extends Api> = {
	type: 'underlinedPart',
	data: LinePart<A>,
}
export type LinePart<A extends Api> = TextLinePart | MentionLinePart<A> | ChatReferenceLinePart<A> | UnderlinedPart<A>;
export type Line<A extends Api> = {
	type: 'line',
	data: LinePart<A>[]
};
export type Text<A extends Api> = string | Line<A>[];
