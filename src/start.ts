import Logger from "@meteor-it/logger";
import ConsoleReceiver from '@meteor-it/logger/receivers/node';
import VKApi from "./api/vk/api";
import { Ayzek } from "./ayzek";
import TGApi from "./api/tg/api";

Logger.addReceiver(new ConsoleReceiver());

const API_KEY = 'ff57bfbf3a3c67afabc6c64d0e2e343447bf9388d57bb5e487056c293393f0a75ac99e099ae076c2f0fb9';

(async () => {
	const vkApi = new VKApi('kraken2', 180370112, [API_KEY]);
	vkApi.messageEvent.on(e => {
		if (e.text === '/ping') {
			e.conversation.send(['Hello, ', {
				type: 'mentionPart',
				data: e.user,
				text: 'пидор'
			}]);
		}
	});
	const ayzek = new Ayzek('ayzek', [vkApi], true);
	await Promise.all([vkApi.loop()]);
})();
