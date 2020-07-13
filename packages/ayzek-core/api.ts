import type { ArgumentType } from '@ayzek/command-parser/arguments';
import { CustomEventBus } from '@ayzek/core/events/custom';
import type { Text } from '@ayzek/text';
import Logger from '@meteor-it/logger';
import { Disposable, isPromise, MaybePromise } from '@meteor-it/utils';
import * as t from 'io-ts';
import { Ayzek } from './ayzek';
import type { Chat, Conversation, Guild, User } from './conversation';
import ApiFeature from './features';
import type { IMessageOptions } from './message';
import { Attachment } from './model/attachment';
import { PluginCategory, PluginInfo } from './plugin';

/**
 * Error thrown if feature isn't supported by api
 */
export class NotImplementedInApiError extends Error {
	constructor(method: string, feature?: ApiFeature) {
		super(`Not implemented in api: ${method}${feature ? ` (From feature: ${feature})` : ''}`);
		this.name = 'NotImplementedInApiError';
	}
}

/**
 * Api implements bridges from messenger ifaces to ayzek events
 */
export abstract class Api {
	/**
	 * Api should prefer to use this logger instead of implementing its own
	 */
	logger: Logger;

	bus = new CustomEventBus();

	constructor(name: string | Logger) {
		this.logger = Logger.from(name);
	}

	/**
	 * Get user by UID
	 */
	getUser(_uid: string): MaybePromise<User | null> {
		return null;
	}

	/**
	 * Get chat by CID
	 */
	getChat(_cid: string): MaybePromise<Chat | null> {
		return null;
	}

	/**
	 * Get either user or chat by UID or CID
	 */
	getConversation(id: string): MaybePromise<Conversation | null> {
		const user = this.getUser(id);
		if (!isPromise(user)) return user;
		if (user === null) return null;
		const chat = this.getChat(id);
		if (!isPromise(chat)) return chat;
		if (chat === null) return null;
		return Promise.all([this.getUser(id), this.getChat(id)]).then(v => v[0] ?? v[1] ?? null);
	}

	/**
	 * Get guild by GID
	 */
	getGuild(_gid: string): MaybePromise<Guild | null> {
		return null;
	}

	/**
	 * Sends message to conversation, verifying or transforming attachments/text
	 *
	 * TODO: Return editable message
	 */
	send(_conv: Conversation, _text: Text, _attachments: Attachment[], _options: IMessageOptions): Promise<void> {
		throw new NotImplementedInApiError('send');
	}

	/**
	 * Contains every feature this api can do
	 */
	protected abstract supportedFeatures: Set<ApiFeature>;

	/**
	 * Check if api can use/mimic passed feature
	 */
	isFeatureSupported(feature: ApiFeature) {
		return this.supportedFeatures.has(feature);
	}

	/**
	 * Starts event loop/connects to server
	 * 
	 * Should return only after successful cancellation
	 */
	public abstract doWork(): Promise<void>;

	/**
	 * Queues API to be cancelled
	 */
	public abstract cancel(): void;

	/**
	 * Since every api have their own mention syntax, this
	 * field holds propper implementation, which then consumed
	 * by userArgument
	 */
	abstract get apiLocalUserArgumentType(): ArgumentType<any, User>;
}

export abstract class ApiPlugin<P extends t.TypeC<any> = any> implements PluginInfo {
	category: PluginCategory = PluginCategory.API;
	name: string;
	constructor(
		name: string,
		public author: string,
		public description: string,
		configType: P, defaultConfig: t.TypeOf<P>, public creator: new (config: t.TypeOf<P>) => Api,
	) {
		this.name = `${name}APIPlugin`;
		this.configType = t.interface({
			local: t.array(configType),
		});
		this.defaultConfig = {
			local: [defaultConfig],
		};
	}

	config!: { local: t.TypeOf<P>[] };
	ayzek!: Ayzek;
	configType: any;
	defaultConfig: any;
	tasks: [Api, Promise<void>, Disposable][] = [];
	async init() {
		for (const config of this.config.local.values()) {
			try {
				const api = new this.creator(config as any);
				const disposePipe = api.bus.pipe(this.ayzek.bus);
				this.tasks.push([api, api.doWork(), disposePipe]);
			} catch (e) {
				console.log('Api initialization error');
				console.log(e.stack);
			}
		}
	}
	async deinit() {
		for (const task of this.tasks) {
			task[2].dispose();
			task[0].cancel();
			await Promise.race([
				task[0],
				task[0],
			]);
		}
	}
}
