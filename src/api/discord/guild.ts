import type { Guild as DSGuild } from "discord.js";
import { Guild } from "../../model/conversation";
import type DiscordApi from "./api";

export default class DiscordGuild extends Guild<DiscordApi> {
	constructor(api: DiscordApi, guild: DSGuild) {
		super(
			api,
			api.encodeGuildGid(guild.id)
		);
	}
}
