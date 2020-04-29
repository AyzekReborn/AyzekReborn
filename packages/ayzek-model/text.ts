import { castOpaquePart, OpaqueTextPart } from "@ayzek/text";
import { Chat, User } from "./conversation";

export const OPAQUE_TYPE = Symbol('text:ayzek')

export type UserTextPart = { ayzekPart: 'user', title?: string, user: User };
export type ChatTextPart = { ayzekPart: 'chat', chat: Chat };

export type AyzekTextPart = UserTextPart | ChatTextPart;

export function opaqueToAyzek(part: OpaqueTextPart): null | AyzekTextPart {
	return castOpaquePart(part, OPAQUE_TYPE);
}
export function ayzekToOpaque(part: AyzekTextPart): OpaqueTextPart {
	return {
		type: 'opaque',
		opaqueType: OPAQUE_TYPE,
		opaque: part,
	}
}
