import { TextChannel } from "discord.js";
import { Chat } from "../../model/conversation";
import DiscordApi from "./api";
import DiscordGuild from "./guild";
import DiscordUser from "./user";

export default class DiscordChat extends Chat<DiscordApi>{
	constructor(api: DiscordApi, guild: DiscordGuild, public apiChat: TextChannel, admins: DiscordUser[], members: DiscordUser[]) {
		super(
			api,
			apiChat.id,
			api.encodeChatUid(apiChat.id),
			members,
			apiChat.name,
			admins,
			guild
		);
	}

	get photoImage() {
		return Promise.resolve(null);
	}
}
