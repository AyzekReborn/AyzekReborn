import { intArgument } from '@ayzek/command-parser/arguments';
import Random from '@meteor-it/random';
import { emit } from '@meteor-it/xrest';
import { userArgument } from "../../bot/argument";
import { command, PluginCategory, PluginInfo } from "../../bot/plugin";
import { File, Image } from '../../model/attachment/attachment';
import * as phrazes from './phrazes.yml';

type CatApiResponse = {
	url: string,
}[]

const whatCommand = command('what')
	.thenArgument('person', userArgument(), b => b
		.executes(({ getArgument }) => {
			const date = new Date();
			const seed = getArgument('person').uid + '|' + Math.floor(date.getMinutes() / 5) + '|' + date.getHours() + '|' + date.getDay();
			const random = new Random(seed);
			return `${random.randomArrayElement(phrazes.what.start)} ${random.randomArrayElement(phrazes.what.end)}`;
		}, 'Определяет что делает в данный момент данный человек')
	);

const shrugCommand = command('shrug')
	.executes(() => `¯\\_(ツ)_/¯`, `¯\\_(ツ)_/¯`);

const catOBotCommand = command('cat-o-bot')
	.thenArgument('Количество', intArgument(1, 50), b =>
		b.executes(async ctx => {
			const catImages: CatApiResponse = (await emit('GET', 'https://api.thecatapi.com/v1/images/search', {
				query: {
					limit: ctx.getArgument('Количество')
				}
			})).jsonBody;
			if (!catImages || catImages.length === 0)
				return await ctx.source.send('Коты не получены (');
			const attachments = await Promise.all(catImages.map(e => e.url.endsWith('.gif') ? File.fromUrl('GET', e.url, {}, 'image.gif', 'image/gif') : Image.fromUrl('GET', e.url, {}, 'photo.jpeg', 'image/jpeg')));
			await ctx.source.send('Лови котов', attachments);
		}, 'Порт котобота жарвиса на айзека')
	);

export default class implements PluginInfo {
	name = 'FloodPlugin';
	author = 'НекийЛач';
	description = 'Плагин для флуда';
	category = PluginCategory.FUN;
	commands = [shrugCommand, whatCommand, catOBotCommand];
	listeners = [];
}
