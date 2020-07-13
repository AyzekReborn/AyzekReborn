import { Ayzek } from '@ayzek/core/ayzek';
import ModernPluginSystem from '@ayzek/core/pluginSystems/ModernPluginSystem';
import Logger from '@meteor-it/logger';
import NodeReceiver from '@meteor-it/logger/receivers/node';

Logger.addReceiver(new NodeReceiver());

const ayzek = new Ayzek('ayzek', true, `${__dirname}/../../config/`);

const apiPluginSystem = new ModernPluginSystem(ayzek,
	() => (require as any).context('../packages/', true, /ayzek(:?-private)?-api-[a-z\-_0-9]+\/index\.ts$/, 'lazy'),
	(module as any).hot,
);
const pluginSystem = new ModernPluginSystem(ayzek,
	() => (require as any).context('../packages/', true, /ayzek(:?-private)?-plugin-[a-z\-_0-9]+\/index\.ts$/, 'lazy'),
	(module as any).hot,
);

(async () => {
	ayzek.logger.log('Starting');
	await Promise.all([
		apiPluginSystem.load(),
		pluginSystem.load(),
	] as Promise<any>[]);
})();
