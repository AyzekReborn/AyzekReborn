import Logger from "@meteor-it/logger";
import { Disposable } from "../util/event";
import { Api } from "../model/api";
import { CommandDispatcher, UnknownThingError, ThingType } from "../command/command";
import { MessageEventContext } from "./context";
import { PluginInfo } from "./plugin";
import ApiFeature from "../api/features";
import { User, Chat, Guild, Conversation } from "../model/conversation";
import { ArgumentType } from "../command/arguments";
import { AttachmentRepository, AttachmentStorage, ownerlessEmptyAttachmentStorage } from "./attachment/attachment";
import { CommandSyntaxError, UserDisplayableError } from "../command/error";

export class Ayzek<A extends Api<any>> extends Api<A> {
	plugins: PluginInfo[] = [];

	userAttachmentRepository: AttachmentRepository<User<any>> = new AttachmentRepository();
	chatAttachmentRepository: AttachmentRepository<Chat<any>> = new AttachmentRepository();

	ayzekAttachmentRepository: AttachmentRepository<Ayzek<A>> = new AttachmentRepository();
	attachmentStorage: AttachmentStorage<Ayzek<A>> = ownerlessEmptyAttachmentStorage;

	async onAyzekAttachmentRepositoryChange() {
		this.attachmentStorage = await this.ayzekAttachmentRepository.getStorageFor(this);
	}

	commandDispatcher = new CommandDispatcher<MessageEventContext<A>>();

	async attachToUser(user: User<any>) {
		user.attachmentStorage = await this.userAttachmentRepository.getStorageFor(user);
	}

	async attachToChat(chat: Chat<any>) {
		chat.attachmentStorage = await this.chatAttachmentRepository.getStorageFor(chat);
		await Promise.all([...chat.users, ...chat.admins].map(user => this.attachToUser(user)));
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
		this.messageEvent.on(async e => {
			await this.attachToUser(e.user);
			if (e.chat)
				await this.attachToChat(e.chat);

			if (e.text.startsWith(commandPrefix)) {
				const command = e.text.replace(commandPrefix, '');
				try {
					const parseResult = await this.commandDispatcher.parse({ ayzek: this, sourceProvider: e.api }, command, new MessageEventContext(this, e));
					await this.commandDispatcher.executeResults(parseResult);
				} catch (err) {
					if (err instanceof CommandSyntaxError) {
						// TODO: Messenger specific formatting & i18n
						const cursor = err.reader.cursor;
						const part = err.reader.readString();
						err.reader.cursor = cursor;
						e.conversation.send([err.message, ` instead of ${part}`, '\n', `${commandPrefix}`, err.reader]);
						err.reader.cursor = cursor;
					} else if (err instanceof UserDisplayableError) {
						e.conversation.send([err.message, '\n', `${commandPrefix}`, err.reader]);
					} else {
						this.logger.error(err.stack);
						e.conversation.send(`Ашипка, жди разраба.`);
					}
				}
			}
		});
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

	get apiLocalUserArgumentType(): ArgumentType<User<A>> {
		throw new Error("Method not implemented.");
	}
}
