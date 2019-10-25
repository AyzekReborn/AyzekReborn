import { User, Chat, Guild } from "../conversation";
import { Api } from "../api";

export abstract class TitleChangeEvent<A extends Api> {
	constructor(
		public api: A,
		public oldTitle: string | null,
		public newTitle: string,
		public initiator: User<A>,
	) { }
}
export class ChatTitleChangeEvent<A extends Api> extends TitleChangeEvent<A> {
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
export class GuildTitleChangeEvent<A extends Api> extends TitleChangeEvent<A> {
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
