import { intArgument } from '@ayzek/command-parser/arguments';
import { File, Image } from '@ayzek/core/model/attachment';
import { command, PluginBase, PluginCategory } from '@ayzek/core/plugin';
import { emit } from '@meteor-it/xrest';
import { whoCommand } from './who';

const SHRUG = '¯\\_(ツ)_/¯';

const shrugCommand = command('shrug')
	.executes(() => SHRUG, SHRUG);

type CatApiResponse = {
	url: string,
}[];

const catOBotCommand = ({ t }: Plugin) => command('cat-o-bot')
	.thenArgument('Количество', intArgument(1, 20), b => b
		.executes(async ctx => {
			const catImages: CatApiResponse = (await emit('GET', 'https://api.thecatapi.com/v1/images/search', {
				query: {
					limit: ctx.getArgument('Количество'),
				},
			})).jsonBody;
			if (!catImages || catImages.length === 0)
				return await ctx.source.send(t`Cats not found`);
			const attachments = await Promise.all(catImages.map(e => e.url.endsWith('.gif') ? File.fromUrl('GET', e.url, {}, 'image.gif', 'image/gif') : Image.fromUrl('GET', e.url, {}, 'photo.jpeg', 'image/jpeg')));
			await ctx.source.send(t`Cats sent!`, attachments);
		}, 'Порт котобота жарвиса на айзека'),
	);

export default class Plugin extends PluginBase {
	name = 'FloodPlugin';
	author = 'НекийЛач';
	description = 'Плагин для флуда';
	category = PluginCategory.FUN;
	commands = [shrugCommand, whoCommand, catOBotCommand];
	listeners = [];
}
