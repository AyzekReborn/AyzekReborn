import type { CommandNode } from '@ayzek/command-parser/tree';
import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import type { Ayzek } from '../ayzek';
import type { PluginInfo } from '../plugin';

export type PluginInfoAttribute = {
	registered?: CommandNode<any, any, any>[];
	file: string;
};

export type ModernPluginContext = {
	ayzek: Ayzek<any>;
}

export default class ModernPluginSystem extends WebpackPluginLoader<ModernPluginContext, PluginInfo & PluginInfoAttribute> {
	constructor(public ayzek: Ayzek<any>, requireContextGetter: () => any, acceptor: (acceptor: () => void, getContext: () => any) => void) {
		super(`modern`, requireContextGetter, acceptor);
	}

	async onLoad(module: PluginInfo & PluginInfoAttribute): Promise<void> {
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
	async onUnload(module: PluginInfo & PluginInfoAttribute): Promise<void> {
		module.registered!.forEach(c => {
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
	async onReload(module: PluginInfo & PluginInfoAttribute): Promise<void> {
		this.onLoad(module);
	}

	async loadPlugins() {
		super.load({ ayzek: this.ayzek });
	}
}
