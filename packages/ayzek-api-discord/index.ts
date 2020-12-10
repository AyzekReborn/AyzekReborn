import StringReader from '@ayzek/command-parser/reader';
import { Api, ApiPlugin } from '@ayzek/core/api';
import { JoinGuildEvent, JoinReason } from '@ayzek/core/events/join';
import { LeaveGuildEvent, LeaveReason } from '@ayzek/core/events/leave';
import { CommandMessageEvent, PlainMessageEvent } from '@ayzek/core/events/message';
import { TypingEvent, TypingEventType } from '@ayzek/core/events/typing';
import ApiFeature from '@ayzek/core/features';
import { IMessage, IMessageOptions } from '@ayzek/core/message';
import { Attachment, BaseFile, File } from '@ayzek/core/model/attachment';
import { opaqueToAyzek } from '@ayzek/core/text';
import { replaceBut } from '@ayzek/core/util/escape';
import { splitByMaxPossibleParts } from '@ayzek/core/util/split';
import { CodeTextPart, FormattingTextPart, HashTagTextPart, Locale, OpaqueTextPart, Text, TextPart } from '@ayzek/text';
import { Component } from '@ayzek/text/component';
import { Preformatted } from '@ayzek/text/translation';
import { lookupByPath } from '@meteor-it/mime';
import * as assert from 'assert';
import { Client, Guild, GuildMember, MessageAttachment, TextChannel, User } from 'discord.js';
import * as t from 'io-ts';
import { DSUserArgumentType } from './arguments';
import DiscordChat from './chat';
import DiscordGuild from './guild';
import DiscordUser from './user';

const MAX_MESSAGE_LENGTH = 2000;

const DiscordApiConfiguration = t.interface({
	descriminator: t.string,
	token: t.string,
});

export class DiscordApi extends Api {

	api: Client;
	private userPrefix: string;
	private chatPrefix: string;
	private guildPrefix: string;

	constructor(public config: t.TypeOf<typeof DiscordApiConfiguration>) {
		super('ds');
		this.api = new Client();
		this.userPrefix = `DSU:${config.descriminator}:`;
		this.chatPrefix = `DSC:${config.descriminator}:`;
		this.guildPrefix = `DSG:${config.descriminator}:`;
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
		await this.api.login(this.config.token);
		this.api.on('guildMemberAdd', async member => {
			this.bus.emit(new JoinGuildEvent(
				this,
				this.wrapMember(await member.fetch()),
				null,
				JoinReason.INVITE_LINK,
				null,
				this.wrapGuild(member.guild),
			));
		});
		this.api.on('guildMemberRemove', async member => {
			this.bus.emit(new LeaveGuildEvent(
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
			const messageData: IMessage = {
				api: this,
				user,
				chat,
				attachments: this.parseAttachments(message.attachments.array()),
				text: message.content,
				replyTo: null,
				forwarded: [],
				messageId: message.id,
			};
			if (messageData.text.startsWith('/') && !messageData.text.startsWith('//') && messageData.text.length != 1) {
				this.bus.emit(new CommandMessageEvent(messageData, messageData.text.slice(1)));
			}
			this.bus.emit(new PlainMessageEvent(messageData));
		});
		this.api.on('typingStart', async (ch, apiUser) => {
			const chat = ch.type === 'dm' ? null : this.wrapChat(ch as TextChannel);
			const user = this.wrapUser(await apiUser.fetch());
			this.bus.emit(new TypingEvent(
				this,
				user,
				chat,
				chat || user,
				TypingEventType.WRITING_TEXT,
			));
		});
	}

	async send(conv: DiscordChat | DiscordUser, text: Text, attachments: Attachment[] = [], _options: IMessageOptions = {}) {
		const textParts = splitByMaxPossibleParts(this.partToString(text, conv.locale), MAX_MESSAGE_LENGTH);
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
			await chat.send(textParts.shift()!);
		}
		if (attachments.length !== 0) {
			for (let i = 0; i < uploadPromises.length; i++) {
				const file = uploadPromises[i];
				await chat.send(i === 0 ? textParts.shift() : undefined, new MessageAttachment(await file[0], file[1]));
			}
		}
		assert.strictEqual(textParts.length, 0, 'Text parts left unsent');
	}

	partToString(part: TextPart, locale?: Locale): string {
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
			return part.map(l => this.partToString(l, locale)).join('');
		}
		if (part instanceof FormattingTextPart) {
			let string = this.partToString(part.text, locale);
			const desc = part.desc;
			if (desc.preserveMultipleSpaces) {
				string = string.replace(/(:?^ | {2})/g, e => '\u2002'.repeat(e.length));
			}
			if (desc.bold) {
				string = `**${replaceBut(string, /\*\*/g, /\\\*\*/g, '')}**`;
			}
			if (desc.underlined) {
				string = `__${replaceBut(string, /__/g, /\\__/g, '')}__`;
			}
			if (desc.italic) {
				string = `*${replaceBut(string, /\*/g, /\\\*/g, '')}*`;
			}
			return string;
		} else if (part instanceof CodeTextPart) {
			return `\`\`\`${part.lang}\n${part.data.replace(/```/g, '\\`\\`\\`')}\`\`\``;
		} else if (part instanceof OpaqueTextPart) {
			const ayzekPart = opaqueToAyzek(part);
			if (!ayzekPart) {
				if (part.fallback)
					return this.partToString(part.fallback, locale);
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
		} else if (part instanceof HashTagTextPart) {
			if (part.hideOnNoSupport) return '';
			return this.partToString(part.tags.map(e => `#${e}`), locale);
		} else if (part instanceof Component) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return this.partToString(part.localize(locale, []), locale);
		} else if (part instanceof Preformatted) {
			if (!locale) {
				throw new Error('locale is not set by anyone');
			}
			return this.partToString(part.localize(locale), locale);
		}
		throw new Error('unreachable');
	}

	async doWork(): Promise<void> {
		await this.init();
	}
	async cancel() { }

	apiLocalUserArgumentType = new DSUserArgumentType(this);

	supportedFeatures = new Set([
		ApiFeature.IncomingMessageWithMultipleAttachments,
		ApiFeature.OutgoingMessageWithMultipleAttachments,
		ApiFeature.GuildSupport,
		ApiFeature.MessageReactions,
	]);
}

export default class DiscordApiPlugin extends ApiPlugin {
	constructor() {
		super(
			'Discord',
			'НекийЛач',
			'Поддержка Discord',
			DiscordApiConfiguration,
			{
				descriminator: 'discordExample',
				token: 'example-token',
			},
			DiscordApi,
		);
	}
}
