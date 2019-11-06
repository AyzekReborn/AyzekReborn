import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import { PluginInfo } from '../plugin';
import { Ayzek } from '../ayzek';
import { CommandNode } from '../../command/tree';

export type PluginInfoAttachment = {
	registered?: CommandNode<any>[];
	file: string;
};

export type ModernPluginContext = {
	ayzek: Ayzek<any>;
}

export default class ModernPluginSystem extends WebpackPluginLoader<ModernPluginContext, PluginInfo & PluginInfoAttachment> {
	constructor(public ayzek: Ayzek<any>, requireContextGetter: () => any, acceptor: (acceptor: () => void, getContext: () => any) => void) {
		super(`modern`, requireContextGetter, acceptor);
		this.pluginContext = { ayzek };
	}

	async onLoad(module: PluginInfo & PluginInfoAttachment): Promise<void> {
		module.registered = module.commands.filter(e => {
			if (this.ayzek.commandDispatcher.root.literals.has(e.literal)) {
				this.logger.warn(`Command ${e.literal} is already registered`);
				return false;
			}
			return true;
		}).map(c => {
			return this.ayzek.commandDispatcher.register(c);
		});
		if (module.userAttachments)
			for (const attachment of module.userAttachments)
				this.ayzek.userAttachmentRepository.addCreator(attachment);
		if (module.chatAttachments)
			for (const attachment of module.chatAttachments)
				this.ayzek.chatAttachmentRepository.addCreator(attachment);
		if (module.conversationAttachments)
			for (const attachment of module.conversationAttachments) {
				this.ayzek.userAttachmentRepository.addCreator(attachment);
				this.ayzek.chatAttachmentRepository.addCreator(attachment);
			}
		if (module.ayzekAttachments) {
			for (const attachment of module.ayzekAttachments) {
				this.ayzek.ayzekAttachmentRepository.addCreator(attachment);
			}
			if (module.ayzekAttachments.length !== 0)
				await this.ayzek.onAyzekAttachmentRepositoryChange();
		}
		module.ayzek = this.ayzek;
		this.ayzek.plugins.push(module);
	}
	async onUnload(module: PluginInfo & PluginInfoAttachment): Promise<void> {
		module.registered!.forEach(c => {
			this.ayzek.commandDispatcher.unregister(c);
		});
		if (module.userAttachments)
			for (const attachment of module.userAttachments)
				this.ayzek.userAttachmentRepository.removeCreator(attachment);
		if (module.chatAttachments)
			for (const attachment of module.chatAttachments)
				this.ayzek.chatAttachmentRepository.removeCreator(attachment);
		if (module.conversationAttachments)
			for (const attachment of module.conversationAttachments) {
				this.ayzek.userAttachmentRepository.removeCreator(attachment);
				this.ayzek.chatAttachmentRepository.removeCreator(attachment);
			}
		if (module.ayzekAttachments) {
			for (const attachment of module.ayzekAttachments) {
				this.ayzek.ayzekAttachmentRepository.removeCreator(attachment);
			}
			if (module.ayzekAttachments.length !== 0)
				await this.ayzek.onAyzekAttachmentRepositoryChange();
		}
		this.ayzek.plugins.splice(this.ayzek.plugins.indexOf(module), 1);
	}
	async onReload(module: PluginInfo & PluginInfoAttachment): Promise<void> {
		this.onLoad(module);
	}
}
