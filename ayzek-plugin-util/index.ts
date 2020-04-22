import { PluginCategory, PluginInfo, command } from "@ayzek/core/plugin";
import { UserDisplayableError } from "@ayzek/command-parser/error";

const RU = 'Ё"№;:?*ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,ёйцукенгшщзхъфывапролджэ\\ячсмитьбю.';
const EN = '~@#$^&*QWERTYUIOP{}ASDFGHJKL:"|ZXCVBNM<>?`qwertyuiop[]asdfghjkl;\'\\zxcvbnm,./';

const commandRfix = command('rfix')
	.executes(ctx => {
		let forwarded = ctx.source.event.maybeForwarded;
		if (!forwarded) throw new UserDisplayableError('Ты не переслал текст!');
		let { text } = forwarded;
		let from: string;
		let to: string;
		let isRus = /[а-я]/i.test(text[0])
		if (isRus) {
			from = RU;
			to = EN;
		} else {
			from = EN;
			to = RU;
		}
		return 'Текст с изменённой раскладкой:\n' + text.split('').map(c => {
			let i = from.indexOf(c);
			if (i === -1) return c;
			return to[i];
		}).join('');
	}, 'Смена раскладки')

export default class implements PluginInfo {
	name = 'UtilPlugin';
	author = 'НекийЛач';
	description = 'Разные утилиты';
	category = PluginCategory.UTILITY;
	commands = [commandRfix];
	listeners = [];
}
