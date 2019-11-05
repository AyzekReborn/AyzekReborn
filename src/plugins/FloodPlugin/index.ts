import { PluginInfo, literal, PluginCategory, argument } from "../../bot/plugin";
import Random from '@meteor-it/random';
import * as phrazes from './phrazes.yml';
import { userArgument } from "../../bot/argument";
import { User } from "../../model/conversation";

const whatCommand = literal('what')
	.then(
		argument('person', userArgument())
			.executes(({ source: { event }, getArgument }) => {
				const date = new Date();
				const seed = getArgument<User<any>>('person').uid + '|' + Math.floor(date.getMinutes() / 5) + '|' + date.getHours() + '|' + date.getDay();
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
