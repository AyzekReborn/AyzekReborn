import Logger from "@meteor-it/logger";
import ConsoleReceiver from '@meteor-it/logger/receivers/node';
import VKApi from "./api/vk/api";
import { Ayzek } from "./bot/ayzek";
import TGApi from "./api/tg/api";
import WebpackPluginLoader from '@meteor-it/plugin-loader/WebpackPluginLoader';
import ModernPluginSystem from "./bot/pluginSystems/ModernPluginSystem";
import { Api } from "./model/api";
import config from "./config.yaml";

Logger.addReceiver(new ConsoleReceiver());

function parseApi(apiDesc: any) {
	switch (apiDesc.type) {
		case 'VK':
			return new VKApi(apiDesc.descriptor, apiDesc.groupId, apiDesc.apiKeys);
		default:
			throw new Error(`Unknown API type: ${apiDesc.type}`);
	}
}

(async () => {
	const apis: Api<any>[] = config.apis.map(parseApi);

	const ayzek = new Ayzek('ayzek', apis, '/', true);
	const ps = new ModernPluginSystem(ayzek,
		() => (require as any).context('./plugins', true, /Plugin\/index\.([jt]sx?|coffee)$/),
		(acceptor, getContext) => (module as any).hot.accept(getContext().id, acceptor))
	await Promise.all([ps.load(), Promise.all(apis.map(e => e.doWork()))]);
})();
