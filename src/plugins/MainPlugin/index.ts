import { PluginInfo, literal, PluginCategory, argument } from "../../bot/plugin";
import { textJoin } from "../../model/text";
import { ArgumentType, StringArgumentType, StringType } from "../../command/arguments";
import { Ayzek } from "../../bot/ayzek";
import { Text } from '../../model/text';
import { padList } from "../../util/pad";



function describePlugin(ayzek: Ayzek<any>, plugin: PluginInfo): Text<any> {
	return [
		`🧩 ${plugin.name}${plugin.category ? ` в категории ${plugin.category}` : ''}\n`,
		`🕵‍ Разработчик: ${plugin.author}\n`,
		`💬 ${plugin.description}`,
		...((plugin.commands.length > 0 || plugin.listeners.length > 0) ? [
			`\n\nСписок фич:\n`,
			textJoin([
				plugin.commands.map(command => {
					const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal);
					return [
						`⚡ /${command.literal} `,
						// TODO: Restricted
						{ type: 'code', data: textJoin(ayzek.commandDispatcher.getAllUsage(commandNode!, null as any, false), '\n') }
					];
				}),
				textJoin(plugin.listeners.map(listener => [
					`👁‍🗨 ${listener.name}${listener.description ? ` — ${listener.description}` : ''}`
				]), '\n')
			], '\n'),
		] : [])
	]
}

const helpCommand = literal('help')
	.then(argument('name', new StringArgumentType(StringType.GREEDY_PHRAZE)).executes(({ source: { ayzek, event }, getArgument }) => {
		const name = getArgument<string>('name');
		const found = ayzek.plugins.find(plugin => plugin.name === name);
		if (!found) {
			event.conversation.send(['Неизвестное название плагина: ', name]);
		} else {
			event.conversation.send(describePlugin(ayzek, found));
		}
		return 0;
	}))
	.then(literal('all').executes(({ source: { ayzek, event } }) => {
		event.conversation.send(textJoin(ayzek.plugins.map(p => describePlugin(ayzek, p)), '\n'));
		return 0;
	}))
	.executes(({ source: { ayzek, event } }) => {
		event.conversation.send([
			`В бота установлены следующие плагины:\n\n`,
			textJoin(ayzek.plugins.map((plugin, i) => textJoin([
				`${i + 1}. ${plugin.name} от ${plugin.author || 'Анонимного разработчика'}`,
				`💬 ${plugin.description || 'Без описания'}`
			], '\n')), '\n\n'),
			'\n\nДля просмотра информации о каждом плагине пиши /help <название>, либо /help all для просмотра портянки ((C) @fishlabsoman)'
		]);
		return 0;
	});

export default class implements PluginInfo {
	file = '';
	name = 'MainPlugin';
	author = 'НекийЛач';
	description = 'Плагин, содержащий некоторые команды - утилиты для управления другими плагинами';
	category = PluginCategory.UTILITY;
	commands = [helpCommand];
	listeners = [];
}
