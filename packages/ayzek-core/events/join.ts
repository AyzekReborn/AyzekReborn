import type { Api } from '../api';
import { Ayzek } from '../ayzek';
import type { Chat, Guild, User } from '../conversation';
import { EVENT_ID } from './custom';

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
	ayzek?: Ayzek;
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
	static [EVENT_ID] = 'ayzek:joinChat';
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
	static [EVENT_ID] = 'ayzek:joinGuild';
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
