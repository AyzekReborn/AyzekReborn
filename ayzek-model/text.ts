import { castOpaquePart, OpaqueTextPart } from "@ayzek/text";
import { Chat, User } from "./conversation";

export const OPAQUE_TYPE = Symbol('text:ayzek')

export type UserTextPart = { ayzekPart: 'user', chat: Chat<any> };
export type ChatTextPart = { ayzekPart: 'chat', user: User<any> };

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
