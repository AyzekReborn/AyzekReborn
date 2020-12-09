import { Chat, User } from '../conversation';
import { EVENT_ID } from './custom';

export class ApplyUserLocaleEvent {
	static [EVENT_ID] = 'ayzek:applyUserLocale';
	constructor(public user: User) { }
}

export class ApplyChatLocaleEvent {
	static [EVENT_ID] = 'ayzek:applyChatLocale';
	constructor(public chat: Chat) { }
}
