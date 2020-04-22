import type { ArgumentType } from "@ayzek/command-parser/arguments";
import { CommandDispatcher } from "@ayzek/command-parser/command";
import { CommandSyntaxError, UserDisplayableError } from "@ayzek/command-parser/error";
import type Logger from "@meteor-it/logger";
import type ApiFeature from "@ayzek/model/features";
import { Api } from "@ayzek/model/api";
import type { Chat, Conversation, Guild, User } from "@ayzek/model/conversation";
import type { MessageEvent } from "@ayzek/model/events/message";
import { craftCommandPayload, parsePayload } from "./model/payload";
import { Text, joinText } from "@ayzek/text";
import { exclude } from "./util/array";
import type { Disposable } from "@meteor-it/utils";
import { levenshteinDistance } from "./util/levenshtein";
import { AttributeRepository, AttributeStorage, ownerlessEmptyAttributeStorage } from "@ayzek/attribute";
import { CommandEventContext, MessageEventContext } from "./context";
import type { AyzekCommandSource, AyzekParseEntryPoint, AyzekParseResults, IMessageListener, PluginInfo } from "./plugin";

const FIX_MAX_DISTANCE = 3;

export class Ayzek<A extends Api<any>> extends Api<A> {
	/**
	 * Loaded plugins
	 */
	plugins: PluginInfo[] = [];

	userAttachmentRepository: AttributeRepository<User<any>> = new AttributeRepository();
	chatAttachmentRepository: AttributeRepository<Chat<any>> = new AttributeRepository();

	ayzekAttachmentRepository: AttributeRepository<Ayzek<A>> = new AttributeRepository();
	attachmentStorage: AttributeStorage<Ayzek<A>> = ownerlessEmptyAttributeStorage;

	async onAyzekAttachmentRepositoryChange() {
		this.attachmentStorage = await this.ayzekAttachmentRepository.getStorageFor(this);
	}

	commandDispatcher = new CommandDispatcher<AyzekCommandSource, Text>();
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

	private async getSuggestionText(entry: AyzekParseEntryPoint, parseResult: AyzekParseResults, source: AyzekCommandSource): Promise<Text> {
		let suggestionListNextCommand = [];
		let suggestionList = [];
		let possibleFixes: string[] = [];
		let suggestionThisArgument = [];
		if (parseResult.reader.string.length === parseResult.reader.cursor) {
			const oldString = parseResult.reader.string;
			const oldCursor = parseResult.reader.cursor;
			parseResult.reader.string += ' ';
			parseResult.reader.cursor++;
			const suggestions = await this.commandDispatcher.getCompletionSuggestions(entry, parseResult as any, parseResult.reader.cursor, source as any);
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

		return suggestionText;
	}

	sendErrorFeedback(error: Error) {
		this.logger.error(error.stack);
	}

	private formatError(error: Error, commandPrefix: string | null): Text {
		if (error instanceof UserDisplayableError) {
			return [error.message, (error.reader && commandPrefix !== null) ? [' ', commandPrefix, error.reader.toStringWithCursor('|')] : null];
		} else {
			this.sendErrorFeedback(error);
			return 'Фатальная ошибка, отчёт отправлен разработчику';
		}
	}

	/**
	 * @param event caused message event
	 * @param command actual command (i.e `help all`)
	 * @param commandPrefix prefix of command to display in fix messages,
	 * 	null in case of payload caused commands
	 */
	private async handleCommand(event: MessageEvent<any>, command: string, commandPrefix: string | null) {
		let parseResult: AyzekParseResults | undefined;
		const source = new CommandEventContext(this, event, command, commandPrefix);
		const entry = { source };
		try {
			parseResult = await this.commandDispatcher.parse(entry, command, source);
			const result = (await this.commandDispatcher.executeResults(parseResult))
				// Filter commands with no response
				.filter(e => e.result === 'error' || e.value);
			if (result.length !== 0) {
				const errored = result
					.filter(e => e.result === 'error');
				if (errored.length === result.length) {
					let suggestionText = (await this.getSuggestionText(entry, parseResult, source));
					await source.send([
						`Все вызовы команды провалились:\n`,
						joinText('\n', ...errored.map(e => (e as { error: Error }).error).map(e => this.formatError(e, commandPrefix))),
						suggestionText,
					])
				} else {
					source.send(joinText('\n', ...result.map(e => {
						if (e.result === 'error') return this.formatError(e.error, commandPrefix);
						return e.value;
					}) as any))
				}
			}
		} catch (err) {
			let suggestionText = parseResult ? (await this.getSuggestionText(entry, parseResult, source)) : null;
			if (err instanceof CommandSyntaxError || err instanceof UserDisplayableError) {
				if (commandPrefix === null) {
					this.sendErrorFeedback(err);
					await source.send([
						err.message,
						'\nПо видимому, эта ошибка вызвана кривой кнопкой.',
						'\nВозможно, ты использовал кнопку на сообщении, которое отсылалось слишком давно'
					]);
				} else {
					await source.send([
						err.message,
						err.reader ? ['\n', `${commandPrefix}`, err.reader] : [],
						suggestionText
					]);
				}
			} else {
				this.sendErrorFeedback(err);
				await source.send([
					`Произошла ошибка, репорт передан разработчику.\nПока можешь попробовать воспользоваться данными предложениями:`,
					suggestionText
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
