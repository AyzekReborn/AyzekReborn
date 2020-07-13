import type { Api } from '../api';
import { Ayzek } from '../ayzek';
import type { Chat, Guild, User } from '../conversation';
import { EVENT_ID } from './custom';

export abstract class TitleChangeEvent {
	ayzek?: Ayzek;
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
	static [EVENT_ID] = 'ayzek:chatTitleChange';
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
	static [EVENT_ID] = 'ayzek:guildTitleChange';
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
