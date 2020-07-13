import { Guild } from '@ayzek/core/conversation';
import type { Guild as DSGuild } from 'discord.js';
import { DiscordApi } from '.';

export default class DiscordGuild extends Guild {
	constructor(api: DiscordApi, guild: DSGuild) {
		super(
			api,
			api.encodeGuildGid(guild.id),
		);
	}
}
