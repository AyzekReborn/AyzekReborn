import { TextChannel } from "discord.js";
import { Chat } from "../../model/conversation";
import DiscordApi from "./api";
import DiscordUser from "./user";
import DiscordGuild from "./guild";

export default class DiscordChat extends Chat<DiscordApi>{
    constructor(api: DiscordApi, guild: DiscordGuild, chat: TextChannel, admins: DiscordUser[], members: DiscordUser[]) {
        super(
            api,
            chat.id,
            api.encodeChatUid(chat.id),
            members,
            chat.name,
            admins,
            guild
        );
    }

    get photoImage() {
        return Promise.resolve(null);
    }
}