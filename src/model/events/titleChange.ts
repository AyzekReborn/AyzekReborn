import { Api } from "../api";
import { Chat, Guild, User } from "../conversation";

export abstract class TitleChangeEvent<A extends Api<A>> {
	constructor(
		public api: A,
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
		public initiator: User<A>,
	) { }
}
export class ChatTitleChangeEvent<A extends Api<A>> extends TitleChangeEvent<A> {
	constructor(
		api: A,
		oldTitle: string | null,
		newTitle: string,
		initiator: User<A>,
		public chat: Chat<A>,
	) {
		super(api, oldTitle, newTitle, initiator);
	}
}
export class GuildTitleChangeEvent<A extends Api<A>> extends TitleChangeEvent<A> {
	constructor(
		api: A,
		oldTitle: string | null,
		newTitle: string,
		initiator: User<A>,
		public chat: Guild<A>,
	) {
		super(api, oldTitle, newTitle, initiator);
	}
}
