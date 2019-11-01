import { PluginInfo, literal, PluginCategory, argument } from "../../bot/plugin";
import { StringArgumentType, StringType } from "../../command/arguments";
import Random from '@meteor-it/random';
import { what, who, better } from './phrazes.yml';

const whatCommand = literal('what')
	.then(
		argument('person', new StringArgumentType(StringType.GREEDY_PHRAZE))
			.executes(({ source: { event }, getArgument }) => {
				const date = new Date();
				const seed = getArgument<string>('person').toLowerCase() + date.getMinutes() + date.getHours() + date.getDay();
				const random = new Random(seed);
				event.conversation.send(`${random.randomArrayElement(what.start)} ${random.randomArrayElement(what.end)}`);
				return 0;
			}))
	;

export default class implements PluginInfo {
	file = '';
	name = 'FloodPlugin';
	author = 'НекийЛач';
	description = 'Плагин для флуда';
	category = PluginCategory.FUN;
	commands = [whatCommand];
	listeners = [];
}
