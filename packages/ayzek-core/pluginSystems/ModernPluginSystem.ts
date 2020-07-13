import type { CommandNode } from '@ayzek/command-parser/tree';
import { readFile, writeFile } from '@meteor-it/fs';
import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import { resolve } from 'path';
import type { Ayzek } from '../ayzek';
import { isConfigurable, PluginInfo } from '../plugin';
import { parseYaml, stringifyYaml } from '../util/config';

export type PluginInfoAttribute = {
	registered?: CommandNode<any, any, any>[];
	file: string;
	loaderData: any;
};

export type ModernPluginContext = {
	ayzek: Ayzek;
}

export default class ModernPluginSystem extends WebpackPluginLoader<ModernPluginContext, PluginInfo & PluginInfoAttribute> {
	constructor(public ayzek: Ayzek, requireContextGetter: () => any, moduleHot: { accept: any }) {
		super('modern', { ayzek }, requireContextGetter, moduleHot);
	}

	async onPreInit(module: PluginInfo & PluginInfoAttribute) {
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
	}

	async onPostInit(module: PluginInfo & PluginInfoAttribute) {
		// TODO: Also perform in-plugin conflict search (currently only cross-plugin check is done)
		module.registered = module.commands?.filter(command => {
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
		if (module.listeners) {
			for (const listener of module.listeners) {
				this.ayzek.bus.on(listener.type, listener.handler);
			}
		}
		module.ayzek = this.ayzek;
		this.ayzek.plugins.push(module);
	}

	async onPreDeinit(_module: PluginInfo & PluginInfoAttribute) {
	}

	async onPostDeinit(module: PluginInfo & PluginInfoAttribute) {
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
		if (module.listeners) {
			for (const listener of module.listeners) {
				this.ayzek.bus.off(listener.type, listener.handler);
			}
		}
		this.ayzek.plugins.splice(this.ayzek.plugins.indexOf(module), 1);
	}

	async onUnload(_module: PluginInfo & PluginInfoAttribute) {
		throw new Error('Method not implemented.');
	}
}
