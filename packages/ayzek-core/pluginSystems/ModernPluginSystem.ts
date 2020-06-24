import type { CommandNode } from '@ayzek/command-parser/tree';
import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import type { Ayzek } from '../ayzek';
import { isConfigurable, PluginInfo } from '../plugin';
import { parseYaml } from '../util/config';

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

			this.logger.log(`Trying to load config from either env ${configEnv} or configs/${module.name}.yaml`);

			const envString = process.env[configEnv];
			if (!envString)
				throw new Error(`Configuration not found for "${module.name}"`);

			module.config = parseYaml(envString, module.configType);
		}
	}

	async onPostInit(module: PluginInfo & PluginInfoAttribute) {
		// TODO: Also perform in-plugin conflict search (currently only cross-plugin check is done)
		module.registered = module.commands.filter(command => {
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
			this.ayzek.listeners.push(...module.listeners);
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
			this.ayzek.listeners.splice(this.ayzek.listeners.indexOf(module.listeners[0]), module.listeners.length);
		}
		this.ayzek.plugins.splice(this.ayzek.plugins.indexOf(module), 1);
	}

	async onUnload(_module: PluginInfo & PluginInfoAttribute) {
		throw new Error('Method not implemented.');
	}
}
