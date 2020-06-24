import StringReader from '@ayzek/command-parser/reader';
import { replaceBut } from '@ayzek/core/util/escape';
import { splitByMaxPossibleParts } from '@ayzek/core/util/split';
import { Api } from '@ayzek/model/api';
import { Attachment, BaseFile, File } from '@ayzek/model/attachment';
import { JoinGuildEvent, JoinReason } from '@ayzek/model/events/join';
import { LeaveGuildEvent, LeaveReason } from '@ayzek/model/events/leave';
import { MessageEvent } from '@ayzek/model/events/message';
import { TypingEvent, TypingEventType } from '@ayzek/model/events/typing';
import ApiFeature from '@ayzek/model/features';
import type { IMessageOptions } from '@ayzek/model/message';
import { opaqueToAyzek } from '@ayzek/model/text';
import type { Text, TextPart } from '@ayzek/text';
import { lookupByPath } from '@meteor-it/mime';
import * as assert from 'assert';
import { Client, Guild, GuildMember, MessageAttachment, TextChannel, User } from 'discord.js';
import { DSUserArgumentType } from './arguments';
import DiscordChat from './chat';
import DiscordGuild from './guild';
import DiscordUser from './user';

const MAX_MESSAGE_LENGTH = 2000;

export default class DiscordApi extends Api {

	api: Client;
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
		const members = chat.members;
		if (members) {
			return members.map((u: User) => this.wrapUser(u));
		}
		const recipients = chat.recipients;
		if (recipients) {
			return recipients.map((u: User) => this.wrapUser(u));
		}
		return [this.wrapUser(chat.recipient)];
	}

	wrapChat(chat: TextChannel): DiscordChat {
		const members = this.extractMembers(chat);
		return new DiscordChat(this, this.wrapGuild(chat.guild), chat, [], members);
	}

	async getApiUser(id: string): Promise<DiscordUser | null> {
		try {
			return this.wrapUser(await this.api.users.fetch(id, true));
		} catch (e) {
			this.logger.error(e.stack);
			return null;
		}
	}

	async getApiChat(id: string): Promise<DiscordChat> {
		return this.wrapChat(await this.api.channels.fetch(id) as TextChannel);
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
			const filename = a.name || '';
			return File.fromUrlWithSizeKnown(
				'GET',
				a.url,
				{},
				a.size,
				filename,
				lookupByPath(filename) || '',
			);
		});
	}

	async init() {
		await this.api.login(this.token);
		this.api.on('guildMemberAdd', async member => {
			this.joinGuildEvent.emit(new JoinGuildEvent(
				this,
				this.wrapMember(await member.fetch()),
				null,
				JoinReason.INVITE_LINK,
				null,
				this.wrapGuild(member.guild),
			));
		});
		this.api.on('guildMemberRemove', async member => {
			this.leaveGuildEvent.emit(new LeaveGuildEvent(
				this,
				this.wrapMember(await member.fetch()),
				null,
				LeaveReason.SELF,
				null,
				this.wrapGuild(member.guild),
			));
		});
		this.api.on('message', message => {
			if (message.author === this.api.user) return;
			const chat = message.channel.type === 'dm' ? null : this.wrapChat(message.channel as TextChannel);
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
				null,
			));
		});
		this.api.on('typingStart', async (ch, apiUser) => {
			const chat = ch.type === 'dm' ? null : this.wrapChat(ch as TextChannel);
			const user = this.wrapUser(await apiUser.fetch());
			this.typingEvent.emit(new TypingEvent(
				this,
				user,
				chat,
				chat || user,
				TypingEventType.WRITING_TEXT,
			));
		});
	}

	async send(conv: DiscordChat | DiscordUser, text: Text, attachments: Attachment[] = [], _options: IMessageOptions = {}) {
		const textParts = splitByMaxPossibleParts(this.partToString(text), MAX_MESSAGE_LENGTH);
		const chat = await this.api.channels.fetch(conv.channelId) as TextChannel;
		if (!chat) throw new Error(`Bad channel: ${conv.channelId}`);
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
				await chat.send(i === 0 ? textParts.shift() : undefined, new MessageAttachment(await file[0], file[1]));
			}
		}
		assert.equal(textParts.length, 0, 'Text parts left unsent');
	}

	partToString(part: TextPart): string {
		if (!part) return part + '';
		if (typeof part === 'number') {
			return part + '';
		} else if (typeof part === 'string')
			return part
				.replace(/`/g, '\\`')
				.replace(/_/g, '\\_')
				.replace(/\*/g, '\\*');
		if (part instanceof StringReader) {
			return `${part.toStringWithCursor('|')}`;
		} else if (part instanceof Array) {
			return part.map(l => this.partToString(l)).join('');
		}
		switch (part.type) {
			case 'formatting': {
				let string = this.partToString(part.data);
				if (part.preserveMultipleSpaces) {
					string = string.replace(/(:?^ | {2})/g, e => '\u2002'.repeat(e.length));
				}
				if (part.bold) {
					string = `**${replaceBut(string, /\*\*/g, /\\\*\*/g, '')}**`;
				}
				if (part.underlined) {
					string = `__${replaceBut(string, /__/g, /\\__/g, '')}__`;
				}
				if (part.italic) {
					string = `*${replaceBut(string, /\*/g, /\\\*/g, '')}*`;
				}
				return string;
			}
			case 'code':
				return `\`\`\`${part.lang}\n${part.data.replace(/```/g, '\\`\\`\\`')}\`\`\``;
			case 'opaque': {
				const ayzekPart = opaqueToAyzek(part);
				if (!ayzekPart) {
					if (part.fallback)
						return this.partToString(part.fallback);
					return '**IDK**';
				}
				switch (ayzekPart.ayzekPart) {
					case 'user': {
						return `<@${(ayzekPart.user as DiscordUser).apiUser.id}>`;
					}
					case 'chat': {
						return `<#${(ayzekPart.chat as DiscordChat).apiChat.id}>`;
					}
				}
				throw new Error('Unreachable');
			}
			case 'hashTagPart':
				if (part.hideOnNoSupport) return '';
				return this.partToString(part.data);
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
		ApiFeature.MessageReactions,
	]);
}
