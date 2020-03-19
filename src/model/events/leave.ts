import type { Api } from "../api";
import type { Chat, Guild, User } from "../conversation";

export enum LeaveReason {
	/**
	 * User is kicked, may return back
	 */
	KICKED,
	/**
	 * User is banned from chat, can't return himself
	 */
	BANNED,
	/**
	 * User leaved himself, and can return in future
	 */
	SELF,
}

export abstract class LeaveEvent<A extends Api<A>> {
	constructor(
		public api: A,
		public user: User<A>,
		public initiator: User<A> | null,
		public reason: LeaveReason,
		public reasonString: string | null,
	) { }
	get isSelf() {
		return this.reason === LeaveReason.SELF;
	}
}
export class LeaveChatEvent<A extends Api<A>> extends LeaveEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: LeaveReason,
		reasonString: string | null,
		public chat: Chat<A>,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
export class LeaveGuildEvent<A extends Api<A>> extends LeaveEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: LeaveReason,
		reasonString: string | null,
		public guild: Guild<A>,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
