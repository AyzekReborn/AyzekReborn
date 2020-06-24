import type { Api } from '../api';
import type { Chat, Guild, User } from '../conversation';

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

export abstract class LeaveEvent {
	constructor(
		public api: Api,
		public user: User,
		public initiator: User | null,
		public reason: LeaveReason,
		public reasonString: string | null,
	) { }
	get isSelf() {
		return this.reason === LeaveReason.SELF;
	}
}
export class LeaveChatEvent extends LeaveEvent {
	constructor(
		api: Api,
		user: User,
		initiator: User | null,
		reason: LeaveReason,
		reasonString: string | null,
		public chat: Chat,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
export class LeaveGuildEvent extends LeaveEvent {
	constructor(
		api: Api,
		user: User,
		initiator: User | null,
		reason: LeaveReason,
		reasonString: string | null,
		public guild: Guild,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
