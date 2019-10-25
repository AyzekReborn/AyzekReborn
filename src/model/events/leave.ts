import { Api } from "../api";
import { User, Chat, Guild } from "../conversation";

export enum LeaveReason {
	KICKED,
	BANNED,
	SELF,
}

export abstract class LeaveEvent<A extends Api> {
	constructor(
		public api: A,
		public user: User<A>,
		public initiator: User<A> | null,
		public reason: LeaveReason,
		public reasonString: string,
	) { }
	get isSelf() {
		return this.reason === LeaveReason.SELF;
	}
}
export class LeaveChatEvent<A extends Api> extends LeaveEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: LeaveReason,
		reasonString: string,
		public chat: Chat<A>,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
export class LeaveGuildEvent<A extends Api> extends LeaveEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: LeaveReason,
		reasonString: string,
		public guild: Guild<A>,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
