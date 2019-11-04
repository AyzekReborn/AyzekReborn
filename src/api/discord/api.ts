import { Client, Guild, User, MessageAttachment, GuildMember } from "discord.js";
import { nonenumerable } from 'nonenumerable';
import { Api } from "../../model/api";
import ApiFeature from "../features";
import DiscordUser from "./user";
import DiscordGuild from "./guild";
import DiscordChat from "./chat";
import { JoinGuildEvent, JoinReason } from "../../model/events/join";
import { LeaveGuildEvent, LeaveReason } from "../../model/events/leave";
import { lookupByPath as lookupMimeByPath } from '@meteor-it/mime';
import { Attachment, File } from "../../model/attachment/attachment";
import { MessageEvent } from "../../model/events/message";

export default class DiscordApi extends Api<DiscordApi> {

    api: Client;
    @nonenumerable
    token: string;

    constructor(public apiId: string, token: string) {
        super('ds');
        this.api = new Client();
        this.token = token;
    }

    encodeUserUid(id: string): string {
        return `DSU:${this.apiId}:${id}`;
    }

    encodeChatUid(id: string): string {
        return `DSC:${this.apiId}:${id}`;
    }

    encodeGuildGid(id: string): string {
        return `DSG:${this.apiId}:${id}`;
    }

    wrapGuild(guild: Guild): DiscordGuild {
        return new DiscordGuild(this, guild);
    }

    wrapUser(user: User): DiscordUser {
        return new DiscordUser(this, user);
    }

    wrapMember(member: GuildMember): DiscordUser {
        return this.wrapUser(member.user);
    }

    private extractMembers(chat: any): DiscordUser[] {
        let members = chat.members;
        if (members) {
            return members.map((u: User) => this.wrapUser(u));
        }
        let recipients = chat.recipients;
        if (recipients) {
            return recipients.map((u: User) => this.wrapUser(u));
        }
        return [this.wrapUser(chat.recipient)];
    }

    wrapChat(chat: any): DiscordChat {
        let members = this.extractMembers(chat);
        return new DiscordChat(this, this.wrapGuild(chat.guild), chat, [], members); // TODO fill one last parameter
    }

    async getApiUser(id: string): Promise<DiscordUser> {
        return this.wrapUser(await this.api.fetchUser(id, true));
    }

    parseAttachments(attachments: MessageAttachment[]): Attachment[] {
        return attachments.map(a => {
            let filename = a.filename;
            return File.fromUrlWithSizeKnown(
                a.url,
                a.filesize,
                filename,
                lookupMimeByPath(filename) || 'text/plain'
            );
        });
    }

    async init() {
        this.api.login(this.token);
        this.api.on('guildMemberAdd', member => {
            this.joinGuildEvent.emit(new JoinGuildEvent(
                this,
                this.wrapMember(member),
                null,
                JoinReason.INVITE_LINK,
                null,
                this.wrapGuild(member.guild)
            ));
        });
        this.api.on('guildMemberRemove', member => {
            this.leaveGuildEvent.emit(new LeaveGuildEvent(
                this,
                this.wrapMember(member),
                null,
                LeaveReason.SELF,
                null,
                this.wrapGuild(member.guild)
            ));
        });
        this.api.on('message', message => {
            let chat = this.wrapChat(message.channel);
            this.messageEvent.emit(new MessageEvent(
                this,
                this.wrapMember(message.member),
                chat,
                chat,
                this.parseAttachments(message.attachments.array()),
                message.content,
                [],
                message.id,
                null
            ));
        });
    }

    async doWork(): Promise<void> {
        await this.init();
    }

    supportedFeatures = new Set([
        ApiFeature.IncomingMessageWithMultipleAttachments,
        ApiFeature.OutgoingMessageWithMultipleAttachments,
        ApiFeature.GuildSupport,
        ApiFeature.MessageReactions
    ]);
}
