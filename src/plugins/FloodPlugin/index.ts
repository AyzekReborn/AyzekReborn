import { PluginInfo, literal, PluginCategory, argument } from "../../bot/plugin";
import { stringArgument } from "../../command/arguments";
import Random from '@meteor-it/random';
import * as phrazes from './phrazes.yml';

const whatCommand = literal('what')
	.then(
		argument('person', stringArgument('greedy_phraze'))
			.executes(({ source: { event }, getArgument }) => {
				const date = new Date();
				const seed = getArgument<string>('person').toLowerCase() + date.getMinutes() + date.getHours() + date.getDay();
				const random = new Random(seed);
				event.conversation.send(`${random.randomArrayElement(phrazes.what.start)} ${random.randomArrayElement(phrazes.what.end)}`);
			}));

export default class implements PluginInfo {
	name = 'FloodPlugin';
	author = 'НекийЛач';
	description = 'Плагин для флуда';
	category = PluginCategory.FUN;
	commands = [whatCommand];
	listeners = [];
}
