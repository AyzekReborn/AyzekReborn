import type { Api } from "../api";
import type { Chat, Guild, User } from "../conversation";

export abstract class TitleChangeEvent {
	constructor(
		public api: Api,
		/**
		 * Title before change
		 */
		public oldTitle: string | null,
		/**
		 * Title after change
		 */
		public newTitle: string,
		/**
		 * Who is changing the title
		 */
		public initiator: User,
	) { }
}
export class ChatTitleChangeEvent extends TitleChangeEvent {
	constructor(
		api: Api,
		oldTitle: string | null,
		newTitle: string,
		initiator: User,
		public chat: Chat,
	) {
		super(api, oldTitle, newTitle, initiator);
	}
}
export class GuildTitleChangeEvent extends TitleChangeEvent {
	constructor(
		api: Api,
		oldTitle: string | null,
		newTitle: string,
		initiator: User,
		public chat: Guild,
	) {
		super(api, oldTitle, newTitle, initiator);
	}
}
