import Logger from "@meteor-it/logger";
import ConsoleReceiver from '@meteor-it/logger/receivers/node';
import VKApi from "./api/vk/api";
import { Ayzek } from "./bot/ayzek";
import ModernPluginSystem from "./bot/pluginSystems/ModernPluginSystem";
import { Api } from "./model/api";
import config from "./config.yaml";
import DiscordApi from "./api/discord/api";

Logger.addReceiver(new ConsoleReceiver());

function parseApi(apiDesc: any) {
	if (!apiDesc.type) throw new Error('Missing api type');
	if (!apiDesc.descriptor) throw new Error('Missing API descriptor');
	switch (apiDesc.type) {
		case 'VK':
			if (!apiDesc.groupId) throw new Error('Missing vk groupId');
			if (typeof apiDesc.groupId !== 'number') throw new Error('VK groupId must be number');
			if (!apiDesc.tokens) throw new Error('Missing vk tokens');
			return new VKApi(apiDesc.descriptor, apiDesc.groupId, apiDesc.tokens);
		case 'DS':
			if (!apiDesc.token) throw new Error('Missing ds token');
			return new DiscordApi(apiDesc.descriptor, apiDesc.token);
		default:
			throw new Error(`Unknown API type: ${apiDesc.type}`);
	}
}

(async () => {
	const apis: Api<any>[] = config.apis.map(parseApi);
	const ayzek = new Ayzek('ayzek', apis, '/', true);
	const ps = new ModernPluginSystem(ayzek,
		() => (require as any).context('./plugins', true, /Plugin\/index\.([jt]sx?|coffee)$/, 'lazy'),
		(acceptor, getContext) => (module as any).hot.accept(getContext().id, acceptor));
	const pps = new ModernPluginSystem(ayzek,
		() => (require as any).context('./privatePlugins', true, /Plugin\/index\.([jt]sx?|coffee)$/, 'lazy'),
		(acceptor, getContext) => (module as any).hot.accept(getContext().id, acceptor))
	await Promise.all([pps.load(), ps.load(), ayzek.doWork()]);
})();
