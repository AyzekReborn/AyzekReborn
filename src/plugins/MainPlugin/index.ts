import { PluginInfo, literal, PluginCategory, argument } from "../../bot/plugin";
import { textJoin } from "../../model/text";
import { stringArgument } from "../../command/arguments";
import { Ayzek } from "../../bot/ayzek";
import { Text } from '../../model/text';
import { padList } from "../../util/pad";

function padAllListItemExceptFirst(list: string[]) {
	return [
		list[0],
		...padList(list.slice(1), '      ')
	];
}

function describePlugin(ayzek: Ayzek<any>, plugin: PluginInfo): Text<any> {
	return [
		`🧩 ${plugin.name}${plugin.category ? ` в категории ${plugin.category}` : ''}\n`,
		`🕵‍ Разработчик: ${plugin.author}\n`,
		`💬 ${plugin.description}`,
		...((plugin.commands.length > 0 || plugin.listeners.length > 0) ? [
			`\n\nСписок фич:\n`,
			textJoin([
				textJoin(plugin.commands.map(command => {
					const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal);
					return [
						`⚡ /${command.literal} `,
						// TODO: Restricted
						{
							type: 'preservingWhitespace',
							data: textJoin(padAllListItemExceptFirst(ayzek.commandDispatcher.getAllUsage(commandNode!, null as any, false)), '\n')
						}
					];
				}), '\n'),
				textJoin(plugin.listeners.map(listener => [
					`👁‍🗨 ${listener.name}${listener.description ? ` — ${listener.description}` : ''}`
				]), '\n')
			].filter(e => e.length !== 0), '\n\n'),
		] : [])
	]
}

const debugCommand = literal('debug')
	.then(literal('mentions').executes(ctx => {
		ctx.source.event.conversation.send([
			'User mention:\n',
			ctx.source.event.user.reference, '\n',
			'Chat mention:\n',
			ctx.source.event.chat && ctx.source.event.chat.reference || 'no chat',
		]);
	}))

const helpCommand = literal('help')
	.then(argument('name', stringArgument('greedy_phraze')).executes(async ({ source: { ayzek, event }, getArgument }) => {
		const name = getArgument<string>('name');
		const found = ayzek.plugins.find(plugin => plugin.name === name);
		if (!found) event.conversation.send(['Неизвестное название плагина: ', name]);
		else event.conversation.send(describePlugin(ayzek, found));
	}))
	.then(literal('all').executes(async ({ source: { ayzek, event } }) => {
		if (event.conversation.isChat)
			await event.conversation.send('Смотри в ЛС, нехуй сюда портянки слать.');
		event.user.send(textJoin(ayzek.plugins.map(p => describePlugin(ayzek, p)), { type: 'preservingWhitespace', data: '\n \n \n' }));
	}))
	.executes(async ({ source: { ayzek, event } }) => {
		event.conversation.send([
			`В бота установлены следующие плагины:\n\n`,
			textJoin(ayzek.plugins.map((plugin, i) => textJoin([
				`${i + 1}. ${plugin.name} от ${plugin.author || 'Анонимного разработчика'}`,
				`💬 ${plugin.description || 'Без описания'}`
			], '\n')), '\n\n'),
			'\n\nДля просмотра информации о каждом плагине пиши /help <название>, либо /help all для просмотра портянки ((C) @fishlabsoman)'
		]);
	});

export default class implements PluginInfo {
	name = 'MainPlugin';
	author = 'НекийЛач';
	description = 'Плагин, содержащий некоторые команды - утилиты для управления другими плагинами';
	category = PluginCategory.UTILITY;
	commands = [debugCommand, helpCommand];
	listeners = [];
}
