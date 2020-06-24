import { Guild } from '@ayzek/model/conversation';
import type { Guild as DSGuild } from 'discord.js';
import type DiscordApi from '.';

export default class DiscordGuild extends Guild {
	constructor(api: DiscordApi, guild: DSGuild) {
		super(
			api,
			api.encodeGuildGid(guild.id),
		);
	}
}
