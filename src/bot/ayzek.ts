import Logger from "@meteor-it/logger";
import ApiFeature from "../api/features";
import { CommandDispatcher } from "../command/command";
import { CommandSyntaxError, UserDisplayableError } from "../command/error";
import { Api } from "../model/api";
import { Chat, Conversation, Guild, User } from "../model/conversation";
import { Disposable } from "../util/event";
import { AttachmentRepository, AttachmentStorage, ownerlessEmptyAttachmentStorage } from "./attachment/attachment";
import { MessageEventContext, CommandEventContext } from "./context";
import { IMessageListener, PluginInfo } from "./plugin";
import { levenshteinDistance } from "../util/levenshtein";
import { parsePayload, craftCommandPayload } from "../model/payload";
import { MessageEvent } from "../model/events/message";
import { ArgumentType } from "../command/arguments";
import { exclude } from "../util/array";
import { parse } from "querystring";

const FIX_MAX_DISTANCE = 5;

export class Ayzek<A extends Api<any>> extends Api<A> {
	/**
	 * Loaded plugins
	 */
	plugins: PluginInfo[] = [];

	userAttachmentRepository: AttachmentRepository<User<any>> = new AttachmentRepository();
	chatAttachmentRepository: AttachmentRepository<Chat<any>> = new AttachmentRepository();

	ayzekAttachmentRepository: AttachmentRepository<Ayzek<A>> = new AttachmentRepository();
	attachmentStorage: AttachmentStorage<Ayzek<A>> = ownerlessEmptyAttachmentStorage;

	async onAyzekAttachmentRepositoryChange() {
		this.attachmentStorage = await this.ayzekAttachmentRepository.getStorageFor(this);
	}

	commandDispatcher = new CommandDispatcher<CommandEventContext<A>>();
	listeners: IMessageListener[] = [];

	async attachToUser(user: User<any>) {
		user.attachmentStorage = await this.userAttachmentRepository.getStorageFor(user);
	}

	async attachToChat(chat: Chat<any>) {
		chat.attachmentStorage = await this.chatAttachmentRepository.getStorageFor(chat);
		await Promise.all([...chat.users, ...chat.admins].map(user => this.attachToUser(user)));
	}

	craftCommandPayload(command: string): string {
		return craftCommandPayload(command, 'dummy');
	}

	constructor(logger: string | Logger, apis: A[], commandPrefix: string, logEvents: boolean) {
		super(logger);
		for (let api of apis) {
			this.attachApi(api);
		}
		if (logEvents) {
			this.messageEvent.on(e => {
				const chat = e.chat ? ` {yellow}${e.chat.title}{/yellow}` : ''
				const text = e.text.trim().length > 0 ? ` ${e.text.trim()}` : '';
				const attachments = e.attachments.length > 0 ? ` {yellow}+${e.attachments.length}A{/yellow}` : ''
				const forwarded = e.maybeForwarded ? ` {green}+${e.forwarded.length + (e.replyTo ? 1 : 0)}F{/green}` : '';
				e.api.logger.log(`${e.user.fullName}${chat} {gray}»{/gray}${text}${attachments}${forwarded}`);
			});
			this.typingEvent.on(e => {
				const chat = e.chat ? `{yellow}${e.chat.title}{/yellow}` : '{green}PM{/green}';
				e.api.logger.log(`${e.user.fullName} typing in ${chat}`);
			});
			this.chatTitleChangeEvent.on(e => {
				e.api.logger.log(`${e.initiator.fullName} renamed {red}${e.oldTitle || '<unknown>'}{/red} -> {green}${e.newTitle}{/green}`);
			});
			this.joinChatEvent.on(e => {
				if (e.initiator)
					e.api.logger.log(`${e.initiator.fullName} added ${e.user.fullName} to ${e.chat.title}`);
				else
					e.api.logger.log(`${e.user.fullName} joined to ${e.chat.title}`);
			});
			this.leaveChatEvent.on(e => {
				if (e.initiator)
					e.api.logger.log(`${e.initiator.fullName} kicked ${e.user.fullName} from ${e.chat.title}`);
				else
					e.api.logger.log(`${e.user.fullName} leaved ${e.chat.title}`);
			});
		}
		this.messageEvent.on(async event => {
			await Promise.all([
				this.attachToUser(event.user),
				event.chat && this.attachToChat(event.chat),
			]);

			const payload = parsePayload(event.payload);

			// Messages with payload are never handled by normal handlers
			if (payload) {
				switch (payload.type) {
					case 'command':
						await this.handleCommand(event, payload.data, null);
						break;
				}
			} else if (event.text.startsWith(commandPrefix)) {
				const command = event.text.slice(commandPrefix.length);
				// Ignores following:
				// /
				// //anything
				// / anything
				if (command.length === 0 || command.startsWith(commandPrefix) || command.trimLeft() !== command) {
					await this.handleMessage(event);
					return;
				}
				await this.handleCommand(event, command, commandPrefix);
			} else {
				await this.handleMessage(event);
			}
		});
	}

	/**
	 * @param event caused message event
	 * @param command actual command (i.e `help all`)
	 * @param commandPrefix prefix of command to display in fix messages,
	 * 	null in case of payload caused commands
	 */
	private async handleCommand(event: MessageEvent<any>, command: string, commandPrefix: string | null) {
		let parseResult;
		const source = new CommandEventContext(this, event, command, commandPrefix);
		const entry = { ayzek: this, sourceProvider: event.api };
		try {
			parseResult = await this.commandDispatcher.parse(entry, command, source);
			await this.commandDispatcher.executeResults(parseResult);
		} catch (err) {
			let suggestionListNextCommand = [];
			let suggestionList = [];
			let possibleFixes: string[] = [];
			let suggestionThisArgument = [];
			if (parseResult) {
				if (parseResult.reader.string.length === parseResult.reader.cursor) {
					const oldString = parseResult.reader.string;
					const oldCursor = parseResult.reader.cursor;
					parseResult.reader.string += ' ';
					parseResult.reader.cursor++;
					const suggestions = await this.commandDispatcher.getCompletionSuggestions(entry, parseResult, parseResult.reader.cursor, source);
					for (let suggestion of suggestions.suggestions) {
						suggestionListNextCommand.push(`${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim())
					}
					parseResult.reader.string = oldString;
					parseResult.reader.cursor = oldCursor;
				}
				{
					const parsedSuccessfully = parseResult.exceptions.size === 0;
					let neededCursor = parsedSuccessfully ? (() => {
						return parseResult.context.nodes[parseResult.context.nodes.length - 1]?.range.start ?? 0;
					})() : parseResult.reader.cursor;
					const currentArgument = parseResult.reader.string.slice(neededCursor)
					const suggestions = await this.commandDispatcher.getCompletionSuggestions(entry, parseResult, neededCursor, source);
					const possibleFixesUnsorted: [string, number][] = [];
					for (let suggestion of suggestions.suggestions) {
						const text = `${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim();
						suggestionList.push(text)
						const distance = levenshteinDistance(suggestion.text, currentArgument, FIX_MAX_DISTANCE);
						if (distance <= FIX_MAX_DISTANCE) {
							possibleFixesUnsorted.push([text, distance]);
						}
					}
					possibleFixes = possibleFixesUnsorted.sort((a, b) => a[1] - b[1]).map(f => f[0]);
				}
				{
					const oldCursor = parseResult.reader.cursor;
					parseResult.reader.cursor = parseResult.reader.string.length;
					const suggestions = await this.commandDispatcher.getCompletionSuggestions(entry, parseResult, parseResult.reader.cursor, source);
					for (let suggestion of suggestions.suggestions) {
						suggestionThisArgument.push(`${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim())
					}
					parseResult.reader.cursor = oldCursor;
				}
			}

			possibleFixes = exclude(possibleFixes, suggestionThisArgument);
			suggestionList = exclude(suggestionList, possibleFixes, suggestionThisArgument);

			const suggestionText = [
				suggestionListNextCommand.length === 0 ? [] : [
					'\n\n',
					`Пример того, что можно поставить следующей командой:\n`,
					suggestionListNextCommand.join(', ')
				],
				suggestionThisArgument.length === 0 ? [] : [
					'\n\n',
					`Пример того, как можно продолжить текущий аргумент:\n`,
					suggestionThisArgument.join(', ')
				],
				possibleFixes.length === 0 ? [] : [
					'\n\n',
					`Возможно ты имел в виду:\n`,
					possibleFixes.join(', ')
				],
				suggestionList.length === 0 ? [] : [
					'\n\n',
					`Пример того, что ещё можно поставить в этом месте:\n`,
					suggestionList.join(', ')
				]
			].filter(e => e.length !== 0);
			if (err instanceof CommandSyntaxError || err instanceof UserDisplayableError) {
				if (commandPrefix === null) {
					await event.conversation.send([
						err.message,
						'\nПо видимому, эта ошибка вызвана кривой кнопкой.',
						'\nВозможно, вы использовали кнопку на сообщении, которое отсылалось слишком давно'
					]);
				} else {
					await event.conversation.send([
						err.message,
						err.reader ? ['\n', `${commandPrefix}`, err.reader] : [],
						suggestionText
					]);
				}
			} else {
				this.logger.error(err.stack);
				event.conversation.send([
					`Произошла ошибка, репорт передан разработчику.\nПока попробуй воспользоваться предложениями`, suggestionText
				]);
			}
		}
	}

	private async handleMessage(event: MessageEvent<any>) {
		const source = new MessageEventContext(this, event);
		for (let listener of this.listeners) {
			listener.handler(source);
		}
	}

	public apis: Api<A>[] = [];
	private apiDisposables: Disposable[][] = []

	public attachApi(api: A) {
		const disposables = [
			api.typingEvent.pipe(this.typingEvent),
			api.messageEvent.pipe(this.messageEvent),

			api.joinGuildEvent.pipe(this.joinGuildEvent),
			api.joinChatEvent.pipe(this.joinChatEvent),

			api.leaveGuildEvent.pipe(this.leaveGuildEvent),
			api.leaveChatEvent.pipe(this.leaveChatEvent),

			api.guildTitleChangeEvent.pipe(this.guildTitleChangeEvent),
			api.chatTitleChangeEvent.pipe(this.chatTitleChangeEvent),
		];
		if (this.apis.push(api) !== this.apiDisposables.push(disposables))
			throw new Error('Api list broken!');
	}

	public detachApi(api: Api<A>) {
		const index = this.apis.indexOf(api);
		if (index === -1)
			throw new Error('Api not found on detach');
		this.apis.splice(index, 1);
		for (let disposable of this.apiDisposables.splice(index, 1)[0])
			disposable.dispose();
	}

	async getUser(uid: string): Promise<User<A> | null> {
		const user = (await Promise.all(this.apis.map(e => e.getUser(uid)))).filter(e => e !== null)[0] || null;
		if (user) await this.attachToUser(user);
		return user;
	}
	async getChat(cid: string): Promise<Chat<A> | null> {
		const chat = (await Promise.all(this.apis.map(e => e.getChat(cid)))).filter(e => e !== null)[0] || null;
		if (chat) await this.attachToChat(chat);
		return chat;
	}
	async getConversation(id: string): Promise<Conversation<A> | null> {
		const [chat, user] = await Promise.all([this.getUser(id), this.getChat(id)]);
		if (chat) return chat;
		return user;
	}

	async getGuild(gid: string): Promise<Guild<A> | null> {
		return (await Promise.all(this.apis.map(e => e.getGuild(gid)))).filter(e => e !== null)[0] || null;
	}

	async doWork(): Promise<any> {
		return Promise.all(this.apis.map(a => a.doWork()))
	}

	get supportedFeatures(): Set<ApiFeature> {
		throw new Error('Not implemented for ayzek');
	}

	get apiLocalUserArgumentType(): ArgumentType<void, User<A>> {
		throw new Error("Method not implemented.");
	}
}
