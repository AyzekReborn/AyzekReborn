import { CommandMessageEvent, PlainMessageEvent } from '@ayzek/core/events/message';
import { IMessage } from '@ayzek/core/message';
import Logger from '@meteor-it/logger';
import { VKApi } from '.';

const PLATFORMS: (string | undefined)[] = [
	undefined,
	'mobile',
	'ipad',
	undefined,
	'android',
	'windows',
	'web',
];

export default class VKUserUpdateHandler {
	logger: Logger;

	constructor(public api: VKApi) {
		this.logger = api.logger;
	}

	async processMessageUpdate(update: any[]) {
		const [message_id, flags, peer_id, , , text, attachments] = update;
		// Outgoing
		if ((flags & 2) != 0) {
			return;
		}
		console.log(update);
		let chat = null;
		let user;
		if (peer_id > 2e9) {
			chat = await this.api.getApiChat(peer_id - 2e9);
			user = await this.api.getApiUser(+attachments.from);
		} else if (peer_id > 1e9) {
			user = await this.api.getApiUser(-(peer_id - 1e9));
		} else {
			user = await this.api.getApiUser(peer_id);
		}
		if (!user) {
			throw new Error('WTF');
		}

		const parsed: IMessage = {
			api: this.api,
			user,
			chat,
			attachments: [],
			text,
			replyTo: null,
			forwarded: [],
			messageId: message_id,
		};
		if (parsed.text.startsWith('/') && !parsed.text.startsWith('//') && parsed.text.length != 1) {
			this.api.bus.emit(new CommandMessageEvent(parsed, parsed.text.slice(1)));
		} else {
			this.api.bus.emit(new PlainMessageEvent(parsed));
		}
	}

	async processOnlineUpdate(update: any[]) {
		const [user_id, extra] = update;
		const user = (await this.api.getApiUser(-user_id))?.fullName;
		const platform = PLATFORMS[extra % 256];
		console.log('ONLINE', user, platform);
	}
	async processOfflineUpdate(update: any[]) {
		const [user_id, flags] = update;
		const user = (await this.api.getApiUser(-user_id))?.fullName;
		console.log('OFFLINE', user, flags);
	}

	async processUpdate(update: any[]) {
		const [id, ...data] = update;
		switch (id) {
			case 4:
				this.processMessageUpdate(data);
				break;
			case 8:
				this.processOnlineUpdate(data);
				break;
			case 9:
				this.processOfflineUpdate(data);
				break;
			default:
				this.logger.warn('Unknown update id: ' + id);
				this.logger.warn(data);
		}
	}
}
