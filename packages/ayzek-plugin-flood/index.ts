import { intArgument } from '@ayzek/command-parser/arguments';
import { command, PluginCategory, PluginInfo } from "@ayzek/core/plugin";
import { File, Image } from '@ayzek/model/attachment';
import { emit } from '@meteor-it/xrest';

const SHRUG = `¯\\_(ツ)_/¯`;

const shrugCommand = command('shrug')
	.executes(() => SHRUG, SHRUG);

type CatApiResponse = {
	url: string,
}[]

const catOBotCommand = command('cat-o-bot')
	.thenArgument('Количество', intArgument(1, 20), b =>
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
	commands = [shrugCommand, catOBotCommand];
	listeners = [];
}
