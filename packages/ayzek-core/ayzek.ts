import { AttributeRepository, AttributeStorage, ownerlessEmptyAttributeStorage } from '@ayzek/attribute';
import type { ArgumentType } from '@ayzek/command-parser/arguments';
import { CommandDispatcher } from '@ayzek/command-parser/command';
import { joinText, Text } from '@ayzek/text';
import type Logger from '@meteor-it/logger';
import { Api } from './api';
import type { AyzekCommandSource, AyzekParseResults } from './command';
import { Chat, Conversation, Guild, User } from './conversation';
import { CommandErrorEvent, CustomEventBus } from './events/custom';
import { JoinChatEvent } from './events/join';
import { LeaveChatEvent } from './events/leave';
import { CommandMessageEvent, PlainMessageEvent } from './events/message';
import { ChatTitleChangeEvent } from './events/titleChange';
import { TypingEvent } from './events/typing';
import ApiFeature from './features';
import { craftCommandPayload, parsePayload } from './model/payload';
import type { PluginInfo } from './plugin';

export class Ayzek extends Api {
	/**
	 * Loaded plugins
	 */
	plugins: PluginInfo[] = [];

	userAttributeRepository: AttributeRepository<User> = new AttributeRepository();
	chatAttributeRepository: AttributeRepository<Chat> = new AttributeRepository();

	ayzekAttributeRepository: AttributeRepository<Ayzek> = new AttributeRepository();
	attributeStorage: AttributeStorage<Ayzek> = ownerlessEmptyAttributeStorage;

	async onAyzekAttributeRepositoryChange() {
		this.attributeStorage = await this.ayzekAttributeRepository.getStorageFor(this);
	}

	commandDispatcher = new CommandDispatcher<AyzekCommandSource, Text>();

	bus = new CustomEventBus();

	async attachToUser(user: User) {
		user.attributeStorage = await this.userAttributeRepository.getStorageFor(user);
	}

	async attachToChat(chat: Chat) {
		chat.attributeStorage = await this.chatAttributeRepository.getStorageFor(chat);
		await Promise.all([...chat.users, ...chat.admins].map(user => this.attachToUser(user)));
	}

	craftCommandPayload(command: string): string {
		return craftCommandPayload(command, 'dummy');
	}

	constructor(logger: string | Logger, logEvents: boolean, public dataDir: string) {
		super(logger);
		if (logEvents) {
			this.bus.on(PlainMessageEvent, e => {
				const chat = e.chat ? ` {yellow}${e.chat.title}{/yellow}` : '';
				const text = e.text.trim().length > 0 ? ` ${e.text.trim()}` : '';
				const attachments = e.attachments.length > 0 ? ` {yellow}+${e.attachments.length}A{/yellow}` : '';
				const forwarded = e.maybeForwarded ? ` {green}+${e.forwarded.length + (e.replyTo ? 1 : 0)}F{/green}` : '';
				e.api.logger.log(`${e.user.fullName}${chat} {gray}»{/gray}${text}${attachments}${forwarded}`);
			});
			this.bus.on(CommandMessageEvent, e => {
				const chat = e.chat ? ` {yellow}${e.chat.title}{/yellow}` : '';
				const text = e.command.trim().length > 0 ? ` ${e.command.trim()}` : '';
				const attachments = e.attachments.length > 0 ? ` {yellow}+${e.attachments.length}A{/yellow}` : '';
				const forwarded = e.maybeForwarded ? ` {green}+${e.forwarded.length + (e.replyTo ? 1 : 0)}F{/green}` : '';
				e.api.logger.log(`${e.user.fullName}${chat} {gray}»{/gray} {red}CMD{/red}${text}${attachments}${forwarded}`);
			});
			this.bus.on(TypingEvent, e => {
				const chat = e.chat ? `{yellow}${e.chat.title}{/yellow}` : '{green}PM{/green}';
				e.api.logger.log(`${e.user.fullName} typing in ${chat}`);
			});
			this.bus.on(ChatTitleChangeEvent, e => {
				e.api.logger.log(`${e.initiator.fullName} renamed {red}${e.oldTitle || '<unknown>'}{/red} -> {green}${e.newTitle}{/green}`);
			});
			this.bus.on(JoinChatEvent, e => {
				if (e.initiator)
					e.api.logger.log(`${e.initiator.fullName} added ${e.user.fullName} to ${e.chat.title}`);
				else
					e.api.logger.log(`${e.user.fullName} joined to ${e.chat.title}`);
			});
			this.bus.on(LeaveChatEvent, e => {
				if (e.initiator)
					e.api.logger.log(`${e.initiator.fullName} kicked ${e.user.fullName} from ${e.chat.title}`);
				else
					e.api.logger.log(`${e.user.fullName} leaved ${e.chat.title}`);
			});
		}
		this.bus.on(CommandMessageEvent, async event => {
			await Promise.all([
				this.attachToUser(event.user),
				event.chat && this.attachToChat(event.chat),
			]);
			event.ayzek = this;
			await this.handleCommand(event);
		});
		this.bus.on(PlainMessageEvent, async event => {
			await Promise.all([
				this.attachToUser(event.user),
				event.chat && this.attachToChat(event.chat),
			]);
			event.ayzek = this;

			const payload = parsePayload(event.payload);

			// Messages with payload are never handled by normal handlers
			if (payload) {
				switch (payload.type) {
					case 'command':
						await this.handleCommand(new CommandMessageEvent(event.message, payload.data));
						break;
				}
			}
		});
	}
	/**
	 * @param event caused message event
	 * @param command actual command (i.e `help all`)
	 * @param commandPrefix prefix of command to display in fix messages,
	 * 	null in case of payload caused commands
	 */
	private async handleCommand(event: CommandMessageEvent) {
		let parseResult: AyzekParseResults | undefined;
		const entry = { source: event };
		try {
			parseResult = await this.commandDispatcher.parse(entry, event.command, event);
			const result = (await this.commandDispatcher.executeResults(parseResult))
				// Filter commands with no response
				.filter(e => e.result === 'error' || e.value);
			const responses = result.filter(e => e.result !== 'error');
			if (responses.length === 0) return;
			event.send(joinText('\n', responses.map(e => {
				return (e as any).value;
			}) as any));
		} catch (err) {
			this.bus.emit(new CommandErrorEvent(event, err));
			console.log(err.stack);
		}
	}

	public apis: Api[] = [];

	async getUser(uid: string): Promise<User | null> {
		const user = (await Promise.all(this.apis.map(e => e.getUser(uid)))).filter(e => e !== null)[0] || null;
		if (user) await this.attachToUser(user);
		return user;
	}
	async getChat(cid: string): Promise<Chat | null> {
		const chat = (await Promise.all(this.apis.map(e => e.getChat(cid)))).filter(e => e !== null)[0] || null;
		if (chat) await this.attachToChat(chat);
		return chat;
	}
	async getConversation(id: string): Promise<Conversation | null> {
		const [chat, user] = await Promise.all([this.getUser(id), this.getChat(id)]);
		if (chat) return chat;
		return user;
	}

	async getGuild(gid: string): Promise<Guild | null> {
		return (await Promise.all(this.apis.map(e => e.getGuild(gid)))).filter(e => e !== null)[0] || null;
	}

	async doWork(): Promise<any> { }
	public cancel() { }

	get supportedFeatures(): Set<ApiFeature> {
		throw new Error('Not implemented for ayzek');
	}

	get apiLocalUserArgumentType(): ArgumentType<void, User> {
		throw new Error('Method not implemented.');
	}
}
