import { Api } from "../api";
import { User, Chat, Guild } from "../conversation";

enum JoinReason {
	INVITED,
	INVITE_LINK,
	RETURNED,
}

export abstract class JoinEvent<A extends Api> {
	constructor(
		public api: A,
		public user: User<A>,
		public initiator: User<A> | null,
		public reason: JoinReason,
		public reasonString: string | null,
	) { }
	get isSelf() {
		return this.reason === JoinReason.INVITE_LINK || this.reason === JoinReason.RETURNED;
	}
}
export class JoinChatEvent<A extends Api> extends JoinEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: JoinReason,
		reasonString: string | null,
		public chat: Chat<A>
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
export class JoinGuildEvent<A extends Api> extends JoinEvent<A> {
	constructor(
		api: A,
		user: User<A>,
		initiator: User<A> | null,
		reason: JoinReason,
		reasonString: string | null,
		public guild: Guild<A>
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
