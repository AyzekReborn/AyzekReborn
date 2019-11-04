import { Client, Guild, User, TextChannel, MessageAttachment } from "discord.js";
import { nonenumerable } from 'nonenumerable';
import { Api } from "../../model/api";
import ApiFeature from "../features";
import DiscordUser from "./user";
import DiscordGuild from "./guild";
import DiscordChat from "./chat";
import { JoinGuildEvent, JoinReason } from "../../model/events/join";
import { LeaveGuildEvent, LeaveReason } from "../../model/events/leave";
import { MessageEvent } from "../../model/events/message";
import { Attachment } from "../../model/attachment/attachment";

export default class DiscordApi extends Api<DiscordApi> {

    api: Client;
    @nonenumerable
    token: string;

    constructor(token: string) {
        super('ds');
        this.api = new Client();
        this.token = token;
    }

    encodeUserUid(id: string): string {
        return `DSU:${id}`;
    }

    encodeChatUid(id: string): string {
        return `DSC:${id}`;
    }

    wrapGuild(guild: Guild) : DiscordGuild {
        return new DiscordGuild(this, guild);
    }

    wrapUser(user: User) : DiscordUser {
        return new DiscordUser(this, user);
    }

    wrapChat(chat: TextChannel) : DiscordChat {
        return new DiscordChat(this, this.wrapGuild(chat.guild), chat, null, null); // TODO fill two last parameters
    }

    getUser(uid: string): Promise<DiscordUser> {
        return this.api.fetchUser(uid, true).then(user => this.wrapUser(user));
    }

    async init() {
        this.api.login(this.token);
        this.api.on('guildMemberAdd', member => {
            this.joinGuildEvent.emit(new JoinGuildEvent(
                this,
                this.wrapUser(member.user),
                null,
                JoinReason.INVITE_LINK,
                null,
                this.wrapGuild(member.guild)
            ));
        });
        this.api.on('guildMemberRemove', member => {
            this.leaveGuildEvent.emit(new LeaveGuildEvent(
                this,
                this.wrapUser(member.user),
                null,
                LeaveReason.SELF,
                null,
                this.wrapGuild(member.guild)
            ));
        });
        this.api.on('message', message => {
        });
    }

    async doWork(): Promise<void> {
        await this.init();
    }

    supportedFeatures = new Set([
        ApiFeature.OutgoingMessageWithMultipleAttachments,
        ApiFeature.GuildSupport,
        ApiFeature.ChatButtons
    ]);
}