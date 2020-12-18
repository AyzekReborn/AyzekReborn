import type { CommandNode } from '@ayzek/command-parser/tree';
import { ParsingData } from '@ayzek/text/component';
import { readFile, writeFile } from '@meteor-it/fs';
import Logger from '@meteor-it/logger';
import { QueueProcessor } from '@meteor-it/queue';
import { assert } from 'console';
import { resolve } from 'path';
import type { Ayzek } from '../ayzek';
import { isConfigurable, PluginBase } from '../plugin';
import { parseYaml, stringifyYaml } from '../util/config';

export type PluginInfoAttribute = {
	registered?: CommandNode<any, any, any>[];
	file: string;
	loaderData: any;
};

export type ModernPluginContext = {
	ayzek: Ayzek;
}

type ReloadData = {
	key: string,
	module: any,
	reloaded: boolean,
}

class WebpackPluginLoaderQueueProcessor extends QueueProcessor<ReloadData, void> {
	constructor(public loader: ModernPluginSystem) {
		super(1);
	}
	async executor(data: ReloadData): Promise<void> {
		return await this.loader.queuedCustomReloadLogic(data);
	}
}

type PluginData = PluginBase & PluginInfoAttribute;

export default class ModernPluginSystem {
	plugins: PluginData[] = [];
	logger: Logger;
	reloadQueue: QueueProcessor<ReloadData, void> = new WebpackPluginLoaderQueueProcessor(this);

	constructor(public ayzek: Ayzek, private requireContextGetter: () => __WebpackModuleApi.RequireContext, private moduleHot: __WebpackModuleApi.Hot) {
		this.logger = new Logger('plugin');
	}

	async onPreInit(module: PluginData) {
		if (isConfigurable(module)) {
			const configEnv = 'CONFIG_' + module.name.replace(/([a-z])([A-Z])/g, (_, a, b) => {
				return `${a.toUpperCase()}_${b.toUpperCase()}`;
			}).toUpperCase().replace(/__+/g, '_');
			const configPath = resolve(this.ayzek.dataDir, module.name.replace(/([a-z])([A-Z])/g, (_, a, b) => {
				return `${a}${b.toUpperCase()}`;
			}) + '.yaml');

			this.logger.log(`Trying to load config from either env ${configEnv} or ${configPath}`);

			let configString = process.env[configEnv];
			if (!configString) {
				try {
					configString = (await readFile(configPath)).toString('utf8');
				} catch {
					// File not found
				}
			}
			if (!configString) {
				this.logger.warn('Config not found, loaded and written default');
				module.config = module.defaultConfig;
				await writeFile(configPath, stringifyYaml(module.config));
			} else {
				try {
					module.config = parseYaml(configString, module.configType);
				} catch (e) {
					this.logger.error('Failed to parse config');
					throw e;
				}
			}
		}

		module.translationStorage.parsingData = new ParsingData();
		if (module.translations) {
			for (const key of module.translations.keys()) {
				if (key.startsWith('./') && key.endsWith('.json')) {
					const langName = key.replace(/^\.\//, '').replace(/\.json$/, '');
					module.translationStorage.define(langName, module.translations(key));
				}
			}
		}

		module.ayzek = this.ayzek;
	}

	async onPostInit(module: PluginData) {
		const commands = module.commands?.map(cmd => {
			if (typeof cmd === 'function') {
				return cmd(module);
			} else {
				return cmd;
			}
		});
		module.resolvedCommands = commands;
		const listeners = module.listeners?.map(listener => {
			if (typeof listener === 'function') {
				return listener(module);
			} else {
				return listener;
			}
		});
		module.resolvedListeners = listeners;
		// TODO: Also perform in-plugin conflict search (currently only cross-plugin check is done)
		module.registered = commands?.filter(command => {
			// FIXME: O(n*m), somehow add alias map to make it O(1)
			if ([...this.ayzek.commandDispatcher.root.literals.values()].some(otherCommand => command.literals.some(name => otherCommand.isMe(name)))) {
				this.logger.warn(`Command ${command.literal} is already registered`);
				return false;
			}
			return true;
		}).map(c => {
			return this.ayzek.commandDispatcher.register(c);
		});
		if (module.userAttributes)
			for (const attachment of module.userAttributes)
				this.ayzek.userAttributeRepository.addCreator(attachment);
		if (module.chatAttributes)
			for (const attachment of module.chatAttributes)
				this.ayzek.chatAttributeRepository.addCreator(attachment);
		if (module.conversationAttributes)
			for (const attachment of module.conversationAttributes) {
				this.ayzek.userAttributeRepository.addCreator(attachment);
				this.ayzek.chatAttributeRepository.addCreator(attachment);
			}
		if (module.ayzekAttributes) {
			for (const attachment of module.ayzekAttributes) {
				this.ayzek.ayzekAttributeRepository.addCreator(attachment);
			}
			if (module.ayzekAttributes.length !== 0)
				await this.ayzek.onAyzekAttributeRepositoryChange();
		}
		if (listeners) {
			for (const listener of listeners) {
				this.ayzek.bus.on(listener.type, listener.handler);
			}
		}
		module.ayzek = this.ayzek;
		this.ayzek.plugins.push(module as PluginBase);
	}

	async onPreDeinit(_module: PluginData) {
	}

	async onPostDeinit(module: PluginData) {
		if (module.registered)
			module.registered?.forEach(c => {
				this.ayzek.commandDispatcher.unregister(c);
			});
		if (module.userAttributes)
			for (const attachment of module.userAttributes)
				this.ayzek.userAttributeRepository.removeCreator(attachment);
		if (module.chatAttributes)
			for (const attachment of module.chatAttributes)
				this.ayzek.chatAttributeRepository.removeCreator(attachment);
		if (module.conversationAttributes)
			for (const attachment of module.conversationAttributes) {
				this.ayzek.userAttributeRepository.removeCreator(attachment);
				this.ayzek.chatAttributeRepository.removeCreator(attachment);
			}
		if (module.ayzekAttributes) {
			for (const attachment of module.ayzekAttributes) {
				this.ayzek.ayzekAttributeRepository.removeCreator(attachment);
			}
			if (module.ayzekAttributes.length !== 0)
				await this.ayzek.onAyzekAttributeRepositoryChange();
		}
		if (module.resolvedListeners) {
			for (const listener of module.resolvedListeners) {
				this.ayzek.bus.off(listener.type, listener.handler);
			}
		}
		this.ayzek.plugins.splice(this.ayzek.plugins.indexOf(module as PluginBase), 1);
	}

	async onUnload(_module: PluginBase & PluginInfoAttribute) {
		throw new Error('Method not implemented.');
	}

	private async callInit(plugin: PluginData) {
		await (this.onPreInit(plugin));
		if (!plugin.init) {
			this.logger.log('Plugin has no init() method, skipping call');
		} else {
			this.logger.log('Calling init()');
			await plugin.init();
		}
		await (this.onPostInit(plugin));
	}

	private async callDeinit(plugin: PluginData) {
		await (this.onPreDeinit(plugin));
		if (!plugin.deinit) {
			this.logger.log('Plugin has no deinit() method, skipping call');
		} else {
			this.logger.log('Calling deinit()');
			await plugin.deinit();
		}
		await (this.onPostDeinit(plugin));
	}

	private async constructPluginInstance(data: ReloadData): Promise<PluginData> {
		let constructor = await data.module;
		if (constructor.default)
			constructor = constructor.default;
		const plugin: PluginData = new constructor();
		plugin.file = data.key;
		plugin.loaderData = data;
		// Object.assign(plugin, this.pluginContext);
		return plugin;
	}

	public async queuedCustomReloadLogic(data: ReloadData) {
		this.logger.ident(`${data.reloaded ? 'Reloading' : 'Loading'} ${data.key}`);
		if (!data.reloaded) {
			try {
				const plugin = await this.constructPluginInstance(data);
				try {
					await this.callInit(plugin);
					this.plugins.push(plugin);
				} catch (e) {
					this.logger.error('Load failed on init()');
					this.logger.error(e.stack);
					await this.callDeinit(plugin);
				}
			} catch (e) {
				this.logger.error('Load failed on early init');
				this.logger.error(e.stack);
			}
		} else {
			try {
				const plugin = await this.constructPluginInstance(data);
				const alreadyLoaded = this.plugins.filter(pl => pl.file === data.key);
				let oldLoaderData: ReloadData | undefined;
				if (alreadyLoaded.length === 0) {
					this.logger.warn('This plugin wasn\'t loaded before');
				} else {
					this.logger.log('Plugin was loaded before, unloading old instances');
					const instances = this.plugins.length;
					for (const alreadyLoadedPlugin of alreadyLoaded) {
						try {
							await this.callDeinit(alreadyLoadedPlugin);
						} catch (e) {
							this.logger.error('Unload failed on deinit()');
							this.logger.error(e.stack);
						}
						// Remove from list
						this.plugins.splice(this.plugins.indexOf(alreadyLoadedPlugin), 1);
					}
					const newInstances = this.plugins.length;
					assert(instances - newInstances === 1, 'More than 1 instance was found loaded in memory');
					oldLoaderData = alreadyLoaded[0].loaderData;
					this.logger.log('Plugin unloaded');
				}
				try {
					await this.callInit(plugin);
					this.plugins.push(plugin);
				} catch (e) {
					this.logger.error('Reload failed on init(), trying to load old plugin again');
					this.logger.error(e.stack);
					if (oldLoaderData) {
						await this.queuedCustomReloadLogic({ key: oldLoaderData.key, module: oldLoaderData.module, reloaded: false });
					}
				}
			} catch (e) {
				this.logger.error('Reload failed on early init');
				this.logger.error(e.stack);
			}
		}
		this.logger.deent();
	}

	async load() {
		const context = this.requireContextGetter();
		const modules: { [key: string]: any } = {};
		context.keys().forEach((key) => {
			const module = context(key);
			modules[key] = module;
			this.reloadQueue.runTask({ key, module, reloaded: false });
		});

		if (this.moduleHot) {
			this.moduleHot.accept(this.requireContextGetter().id, () => {
				const reloadedContext = this.requireContextGetter();
				reloadedContext.keys().map(key => [key, reloadedContext(key)]).filter(reloadedModule => modules[reloadedModule[0]] !== reloadedModule[1]).forEach((module) => {
					modules[module[0]] = module[1];
					this.reloadQueue.runTask({ key: module[0], module: module[1], reloaded: true });
				});
			});
		}

		return this.plugins;
	}
}
