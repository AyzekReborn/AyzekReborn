import Logger from "@meteor-it/logger";
import ConsoleReceiver from '@meteor-it/logger/receivers/node';
import VKApi from "./api/vk/api";

Logger.addReceiver(new ConsoleReceiver());

const API_KEY = 'ff57bfbf3a3c67afabc6c64d0e2e343447bf9388d57bb5e487056c293393f0a75ac99e099ae076c2f0fb9';



const api = new VKApi('kraken2', 180370112, [API_KEY]);
(async () => {
	await api.loop();
})();
