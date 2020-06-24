import type { Api } from '../api';
import type { Chat, Guild, User } from '../conversation';

export enum JoinReason {
	/**
	 * By user
	 */
	INVITED,
	/**
	 * Itself
	 */
	INVITE_LINK,
	/**
	 * Returned after leave
	 */
	RETURNED,
}

export abstract class JoinEvent {
	constructor(
		public api: Api,
		public user: User,
		public initiator: User | null,
		public reason: JoinReason,
		public reasonString: string | null,
	) { }
	get isSelf() {
		return this.reason === JoinReason.INVITE_LINK || this.reason === JoinReason.RETURNED;
	}
}
export class JoinChatEvent extends JoinEvent {
	constructor(
		api: Api,
		user: User,
		initiator: User | null,
		reason: JoinReason,
		reasonString: string | null,
		public chat: Chat,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
export class JoinGuildEvent extends JoinEvent {
	constructor(
		api: Api,
		user: User,
		initiator: User | null,
		reason: JoinReason,
		reasonString: string | null,
		public guild: Guild,
	) {
		super(api, user, initiator, reason, reasonString);
	}
}
