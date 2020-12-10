import { UserDisplayableError } from '@ayzek/command-parser/error';
import { command, PluginBase, PluginCategory } from '@ayzek/core/plugin';

const RU = 'Ё"№;:?*ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,ёйцукенгшщзхъфывапролджэ\\ячсмитьбю.';
const EN = '~@#$^&*QWERTYUIOP{}ASDFGHJKL:"|ZXCVBNM<>?`qwertyuiop[]asdfghjkl;\'\\zxcvbnm,./';

const commandRfix = ({ t }: Plugin) => command('rfix')
	.executes(ctx => {
		const forwarded = ctx.source.maybeForwarded;
		if (!forwarded) throw new UserDisplayableError('Ты не переслал текст!');
		const { text } = forwarded;
		let from: string;
		let to: string;
		const isRus = /[а-я]/i.test(text[0]);
		if (isRus) {
			from = RU;
			to = EN;
		} else {
			from = EN;
			to = RU;
		}
		return [
			t`Text with fixed layout:`, '\n',
			text.split('').map(c => {
				const i = from.indexOf(c);
				if (i === -1) return c;
				return to[i];
			}).join(''),
		];
	}, 'Смена раскладки');

export default class Plugin extends PluginBase {
	name = 'UtilPlugin';
	author = 'НекийЛач';
	description = 'Разные утилиты';
	category = PluginCategory.UTILITY;
	commands = [commandRfix];
	listeners = [];
}
