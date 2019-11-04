import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import { PluginInfo } from '../plugin';
import { Ayzek } from '../ayzek';
import { CommandNode } from '../../command/tree';

type PluginInfoAttachment = {
	registered?: CommandNode<any>[];
	file: string;
};
export default class ModernPluginSystem extends WebpackPluginLoader<void, PluginInfo & PluginInfoAttachment> {

	constructor(public ayzek: Ayzek<any>, requireContextGetter: () => any, acceptor: (acceptor: () => void, getContext: () => any) => void) {
		super(`modern`, requireContextGetter, acceptor);
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
		this.ayzek.plugins.push(module);
	}
	async onUnload(module: PluginInfo & PluginInfoAttachment): Promise<void> {
		module.registered!.forEach(c => {
			this.ayzek.commandDispatcher.unregister(c);
		});
		this.ayzek.plugins.splice(this.ayzek.plugins.indexOf(module), 1);
	}
	async onReload(module: PluginInfo & PluginInfoAttachment): Promise<void> {
		this.onLoad(module);
	}
}
