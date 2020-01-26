import { Ayzek } from "../../bot/ayzek";
import { MessageEventContext } from "../../bot/context";
import { command, PluginCategory, PluginInfo } from "../../bot/plugin";
import { stringArgument } from "../../command/arguments";
import { Text, textJoin } from "../../model/text";
import { padList } from "../../util/pad";
import { Requirement } from "../../command/requirement";
import { CommandContext } from "../../command/command";
import { Api } from "../../model/api";
import VKApi, { IVKMessageOptions } from "../../api/vk/api";

function padAllListItemExceptFirst(list: string[]) {
	return [
		list[0],
		...padList(list.slice(1), '      ')
	];
}

function describePlugin(ctx: MessageEventContext<any>, ayzek: Ayzek<any>, plugin: PluginInfo): Text<any> {
	return [
		`🔌 ${plugin.name}${plugin.category ? ` в категории ${plugin.category}` : ''}\n`,
		`🕵‍ Разработчик: ${plugin.author}\n`,
		`💬 ${plugin.description}`,
		...((plugin.commands.length > 0 || plugin.listeners.length > 0) ? [
			`\n\nСписок фич:\n`,
			textJoin([
				textJoin(plugin.commands.map(command => {
					const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal)!;
					if (!commandNode.canUse(ctx)) return null;
					return [
						`⚡ /${command.literal} `,
						{
							type: 'preservingWhitespace',
							data: textJoin(padAllListItemExceptFirst(ayzek.commandDispatcher.getAllUsage(commandNode, ctx, true)), '\n')
						}
					];
				}).filter(e => e !== null).map(e => e!) as any, '\n'),
				textJoin(plugin.listeners.map(listener => [
					`👁‍🗨 ${listener.name}${listener.description ? ` — ${listener.description}` : ''}`
				]), '\n')
			].filter(e => e.length !== 0), '\n\n'),
		] : [])
	]
}

const requirementIsDevelopment: Requirement<any> = () => process.env.NODE_ENV === 'development';

function requireApi<T extends Api<any>>(api: new (...args: any[]) => T): Requirement<any> {
	return source => {
		return source.event.api instanceof api
	};
}

const debugCommand = command('debug')
	.thenLiteral('mentions', b => b
		.executes(ctx => {
			ctx.source.event.conversation.send([
				'User mention: ', ctx.source.event.user.reference, '\n',
				'Chat mention: ', ctx.source.event.chat && ctx.source.event.chat.reference || 'no chat',
			]);
		}, 'Проверка упоминаний'))
	.thenLiteral('id', b => b
		.executes(ctx => {
			ctx.source.event.conversation.send([
				`UID: ${ctx.source.event.user.uid}\n`,
				`CID: `, ctx.source.event.chat && ctx.source.event.chat.cid || 'no chat', '\n',
				`Full name: ${ctx.source.event.user.fullName}\n`,
				`Name: ${ctx.source.event.user.name}\n`
			]);
		}, 'ID юзера и чата'))
	.thenLiteral('msg', b => b
		.executes(ctx => {
			const forwarded = ctx.source.event.maybeForwarded;
			if (!forwarded) {
				ctx.source.event.conversation.send(['No forwarded']);
				return;
			}
			ctx.source.event.conversation.send([
				`UID: ${forwarded.user.uid}\n`,
				`Full name: ${forwarded.user.fullName}\n`,
			]);
		}, 'Просмотр информации о пересланом сообщении'))
	.thenLiteral('keyboard', b => b
		.requires(requireApi(VKApi))
		.executes(async ctx => {
			await ctx.source.event.conversation.send('Keyboard, wow', [], {
				vkKeyboard: {
					inline: true,
					buttons:
						[[{
							action: {
								type: 'text',
								label: 'test',
								payload: '{"text":"asd"}'
							},
							color: 'positive'
						}]],
				}
			} as IVKMessageOptions)
		}, 'Тест клавиатуры бота'))
	.thenLiteral('length-limit-bypass', b => b
		// 20200 chars, only in development mode
		.requires(requirementIsDevelopment)
		.executes(async ctx => {
			await ctx.source.event.conversation.send(('a'.repeat(100) + ' ').repeat(200));
		}, 'Отсылает огромную строку'));

const helpCommand = command('help')
	.thenArgument('name', stringArgument('greedy_phraze'), b => b
		.executes(async ctx => {
			const { source: { event, ayzek }, getArgument } = ctx;
			const name = getArgument('name');
			const found = ayzek.plugins.find(plugin => plugin.name === name);
			if (!found) event.conversation.send(['Неизвестное название плагина: ', name]);
			else event.conversation.send(describePlugin(ctx.source, ayzek, found));
		}, 'Просмотр информации о плагине'))
	.thenLiteral('all', b => b
		.executes(async ctx => {
			const { source: { event, ayzek } } = ctx;
			try {
				await event.user.send(textJoin(ayzek.plugins.map(p => describePlugin(ctx.source, ayzek, p)), { type: 'preservingWhitespace', data: '\n \n \n' }));
				if (event.conversation.isChat)
					await event.conversation.send('Помощь отправлена тебе в ЛС');
			} catch (e) {
				if (event.conversation.isChat)
					await event.conversation.send('У тебя закрыты ЛС, \n/help all отсылает ответ только туда, т.к это слишком длинное сообщение');
				else
					console.error(e.stack);
			}
		}, 'Просмотр информации о всех плагинах'))
	.executes(async ({ source: { ayzek, event } }) => {
		event.conversation.send([
			`В бота установлены следующие плагины:\n\n`,
			textJoin(ayzek.plugins.map((plugin, i) => textJoin([
				`${i + 1}. ${plugin.name} от ${plugin.author || 'Анонимного разработчика'}`,
				`💬 ${plugin.description || 'Без описания'}`
			], '\n')), '\n\n'),
			'\n\nДля просмотра информации о каждом плагине пиши /help <название>, либо /help all для просмотра портянки ((C) @fishlabsoman)'
		]);
	}, 'Показ списка плагинов');

export default class implements PluginInfo {
	name = 'MainPlugin';
	author = 'НекийЛач';
	description = 'Плагин, содержащий некоторые команды - утилиты для управления другими плагинами';
	category = PluginCategory.UTILITY;
	commands = [debugCommand, helpCommand];
	listeners = [];
}
