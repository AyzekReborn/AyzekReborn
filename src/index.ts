import DiscordApi from '@ayzek/api-discord';
import TelegramApi from '@ayzek/api-telegram';
import VKApi from '@ayzek/api-vk';
import { Ayzek } from '@ayzek/core/ayzek';
import ModernPluginSystem from '@ayzek/core/pluginSystems/ModernPluginSystem';
import { parseYaml } from '@ayzek/core/util/config';
import Logger from '@meteor-it/logger';
import NodeReceiver from '@meteor-it/logger/receivers/node';
import * as t from 'io-ts';

Logger.addReceiver(new NodeReceiver());

const VKApiData = t.interface({
	type: t.literal('VK'),
	descriptor: t.string,
	tokens: t.array(t.string),
	groupId: t.number,
}, 'VKApiData');
const DiscordApiData = t.interface({
	type: t.literal('Discord'),
	descriptor: t.string,
	token: t.string,
}, 'DiscordApiData');
const TelegramApiData = t.interface({
	type: t.literal('Telegram'),
	descriptor: t.string,
	token: t.string,
	username: t.string,
}, 'TelegramApiData');

const ApiData = t.union([
	VKApiData,
	DiscordApiData,
	TelegramApiData,
]);

function createApi(apiDesc: t.TypeOf<typeof ApiData>) {
	switch (apiDesc.type) {
		case 'VK':
			if (!apiDesc.groupId) throw new Error('Missing vk groupId');
			if (typeof apiDesc.groupId !== 'number') throw new Error('VK groupId must be number');
			if (!apiDesc.tokens) throw new Error('Missing vk tokens');
			return new VKApi(apiDesc.descriptor, apiDesc.groupId, apiDesc.tokens);
		case 'Discord':
			if (!apiDesc.token) throw new Error('Missing ds token');
			return new DiscordApi(apiDesc.descriptor, apiDesc.token);
		case 'Telegram':
			if (!apiDesc.token) throw new Error('Missing tg token');
			if (!apiDesc.username) throw new Error('missing username');
			return new TelegramApi(apiDesc.descriptor, apiDesc.username, apiDesc.token);
	}
}

const ayzek = new Ayzek('ayzek', '/', true, `${__dirname}/../../config/`);

const pluginSystem = new ModernPluginSystem(ayzek,
	() => (require as any).context('../packages/', true, /ayzek(:?-private)?-plugin-[a-z\-_0-9]+\/index\.ts$/, 'lazy'),
	(module as any).hot,
);

(async () => {
	ayzek.logger.log('Attaching static apis');
	const configString = process.env['CONFIG_AYZEK_API'];
	if (!configString) throw new Error('API configuration not found at env CONFIG_AYZEK_API');
	const apis = parseYaml(configString, t.array(ApiData)).map(createApi);
	apis.forEach(a => ayzek.attachApi(a));

	ayzek.logger.log('Starting');
	await Promise.all([...apis.map(a => a.doWork()), pluginSystem.load()] as Promise<any>[]);
})();
