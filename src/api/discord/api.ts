import { lookupByPath } from '@meteor-it/mime';
import { Client, Guild, GuildMember, MessageAttachment, TextChannel, User, Attachment as DiscordApiAttachment } from "discord.js";
import { nonenumerable } from 'nonenumerable';
import { NoSuchUserError } from "../../bot/argument";
import { ArgumentType } from "../../command/arguments";
import { ParseEntryPoint } from "../../command/command";
import { ExpectedSomethingError } from "../../command/error";
import StringReader from "../../command/reader";
import { Api } from "../../model/api";
import { Attachment, File, BaseFile } from "../../model/attachment/attachment";
import { Conversation } from "../../model/conversation";
import { JoinGuildEvent, JoinReason } from "../../model/events/join";
import { LeaveGuildEvent, LeaveReason } from "../../model/events/leave";
import { MessageEvent } from "../../model/events/message";
import { TypingEvent, TypingEventType } from "../../model/events/typing";
import { IMessageOptions } from "../../model/message";
import { Text, TextPart } from "../../model/text";
import ApiFeature from "../features";
import DiscordChat from "./chat";
import DiscordGuild from "./guild";
import DiscordUser from "./user";
import { splitByMaxPossibleParts } from '../../util/split';
import * as assert from 'assert';
import { DSUserArgumentType } from './arguments';

const MAX_MESSAGE_LENGTH = 2000;

export default class DiscordApi extends Api<DiscordApi> {

	api: Client;
	@nonenumerable
	token: string;
	private userPrefix: string;
	private chatPrefix: string;
	private guildPrefix: string;

	constructor(public apiId: string, token: string) {
		super('ds');
		this.api = new Client();
		this.token = token;
		this.userPrefix = `DSU:${apiId}:`;
		this.chatPrefix = `DSC:${apiId}:`;
		this.guildPrefix = `DSG:${apiId}:`;
	}

	encodeUserUid(uid: string): string {
		return `${this.userPrefix}${uid}`;
	}

	encodeChatUid(cid: string): string {
		return `${this.chatPrefix}${cid}`;
	}

	encodeGuildGid(gid: string): string {
		return `${this.guildPrefix}${gid}`;
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

	async getApiUser(id: string): Promise<DiscordUser | null> {
		try {
			return this.wrapUser(await this.api.fetchUser(id, true));
		} catch (e) {
			this.logger.error(e.stack);
			return null;
		}
	}

	async getApiChat(id: string): Promise<DiscordChat> {
		return this.wrapChat(this.api.channels.get(id));
	}

	getUser(uid: string): Promise<DiscordUser | null> {
		if (!uid.startsWith(this.userPrefix)) {
			return Promise.resolve(null);
		}
		const id = uid.replace(this.userPrefix, '');
		return this.getApiUser(id);
	}

	getChat(cid: string): Promise<DiscordChat | null> {
		if (!cid.startsWith(this.chatPrefix)) {
			return Promise.resolve(null);
		}
		const id = cid.replace(this.chatPrefix, '');
		return this.getApiChat(id);
	}

	parseAttachments(attachments: MessageAttachment[]): Attachment[] {
		return attachments.map(a => {
			let filename = a.filename;
			return File.fromUrlWithSizeKnown(
				'GET',
				a.url,
				{},
				a.filesize,
				filename,
				lookupByPath(filename) || ''
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
			if (message.author === this.api.user) return;
			const chat = message.channel.type === 'dm' ? null : this.wrapChat(message.channel);
			const user = this.wrapUser(message.author);
			this.messageEvent.emit(new MessageEvent(
				this,
				user,
				chat,
				chat || user,
				this.parseAttachments(message.attachments.array()),
				message.content,
				[],
				message.id,
				null
			));
		});
		this.api.on('typingStart', (ch, apiUser) => {
			const chat = ch.type === 'dm' ? null : this.wrapChat(ch);
			const user = this.wrapUser(apiUser);
			this.typingEvent.emit(new TypingEvent(
				this,
				user,
				chat,
				chat || user,
				TypingEventType.WRITING_TEXT
			));
		})
	}

	async send(conv: Conversation<DiscordApi>, text: Text<DiscordApi>, attachments: Attachment[] = [], _options: IMessageOptions = {}) {
		const textParts = splitByMaxPossibleParts(this.textToString(text), MAX_MESSAGE_LENGTH);
		const chat = this.api.channels.get(conv.targetId) as TextChannel;
		if (!chat) throw new Error(`Bad channel: ${conv.targetId}`);
		const uploadPromises: [Promise<Buffer>, string][] = attachments.map(a => {
			if (a.type === 'location' || a.type === 'messenger_specific')
				throw new Error('Unsupported attachment type for discord: ' + a.type);
			const file = a as BaseFile;
			return [file.data.toBuffer(), file.name];
		});
		const partsToSentBeforeAttachments = (textParts.length - (attachments.length === 0 ? 0 : 1));
		for (let i = 0; i < partsToSentBeforeAttachments; i++) {
			await chat.send(textParts.shift());
		}
		if (attachments.length !== 0) {
			for (let i = 0; i < uploadPromises.length; i++) {
				const file = uploadPromises[i];
				await chat.send(i === 0 ? textParts.shift() : undefined, new DiscordApiAttachment(await file[0], file[1]));
			}
		}
		assert.equal(textParts.length, 0, 'Text parts left unsent');
	}

	textToString(part: TextPart<DiscordApi>): string {
		if (!part) return part + '';
		if (typeof part === 'string')
			return part
				.replace(/`/g, '\\`')
				.replace(/_/g, '\\_');
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor(`|`)}`
		} else if (part instanceof Array) {
			return part.map(l => this.textToString(l)).join('');
		}
		switch (part.type) {
			case 'preservingWhitespace':
				return this.textToString(part.data).replace(/(:?^ |  )/g, e => '\u2002'.repeat(e.length));
			case 'code':
				// TODO: Multiline comments
				return `\`${this.textToString(part.data)}\``;
			case 'mentionPart':
				return `<@${(part.data as any as DiscordUser).apiUser.id}>`;
			case 'chatRefPart':
				return `<#${part.data.targetId}>`;
			case 'underlinedPart':
				return `__${this.textToString(part.data)}__`;
			case 'boldPart':
				return `**${this.textToString(part.data)}**`;
			case 'hashTagPart':
				if (part.hideOnNoSupport) return '';
				return this.textToString(part.data);
		}
	}

	async doWork(): Promise<void> {
		await this.init();
	}

	apiLocalUserArgumentType = new DSUserArgumentType(this);

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.GuildSupport,
		ApiFeature.MessageReactions
	]);
}
