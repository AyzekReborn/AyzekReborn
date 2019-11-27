import Random from '@meteor-it/random';
import { userArgument } from "../../bot/argument";
import { command, PluginCategory, PluginInfo } from "../../bot/plugin";
import * as phrazes from './phrazes.yml';

const whatCommand = command('what')
	.thenArgument('person', userArgument(), b => b
		.executes(({ source: { event }, getArgument }) => {
			const date = new Date();
			const seed = getArgument('person').uid + '|' + Math.floor(date.getMinutes() / 5) + '|' + date.getHours() + '|' + date.getDay();
			const random = new Random(seed);
			event.conversation.send(`${random.randomArrayElement(phrazes.what.start)} ${random.randomArrayElement(phrazes.what.end)}`);
		}));

const shrugCommand = command('shrug')
	.executes(({ source: { event } }) => {
		event.conversation.send(`¯\\_(ツ)_/¯`)
	})

export default class implements PluginInfo {
	name = 'FloodPlugin';
	author = 'НекийЛач';
	description = 'Плагин для флуда';
	category = PluginCategory.FUN;
	commands = [shrugCommand, whatCommand];
	listeners = [];
}
