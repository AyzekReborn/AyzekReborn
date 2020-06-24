import { Chat } from '@ayzek/model/conversation';
import type { TextChannel } from 'discord.js';
import type DiscordApi from '.';
import type DiscordGuild from './guild';
import type DiscordUser from './user';

export default class DiscordChat extends Chat {
	constructor(api: DiscordApi, guild: DiscordGuild, public apiChat: TextChannel, admins: DiscordUser[], members: DiscordUser[]) {
		super(
			api,
			api.encodeChatUid(apiChat.id),
			members,
			apiChat.name,
			admins,
			guild,
		);
	}

	get channelId(): string {
		return this.apiChat.id;
	}

	get photoImage() {
		return Promise.resolve(null);
	}
}
