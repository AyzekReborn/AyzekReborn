import VKApi, { IVKMessageOptions } from '@ayzek/api-vk';
import { SimpleArgumentType, stringArgument } from '@ayzek/command-parser/arguments';
import { CommandSyntaxError, UnknownSomethingError, UserDisplayableError } from '@ayzek/command-parser/error';
import type StringReader from '@ayzek/command-parser/reader';
import type { Suggestions, SuggestionsBuilder } from '@ayzek/command-parser/suggestions';
import { CommandNode } from '@ayzek/command-parser/tree';
import type { Ayzek } from '@ayzek/core/ayzek';
import { AyzekCommandContext, AyzekCommandRequirement, AyzekCommandSource, AyzekParseEntryPoint, AyzekParseResults } from '@ayzek/core/command';
import { CommandErrorEvent } from '@ayzek/core/events/custom';
import { command, PluginCategory, PluginInfo } from '@ayzek/core/plugin';
import { requireHidden } from '@ayzek/core/requirements';
import { levenshteinDistance } from '@ayzek/core/util/levenshtein';
import { joinText, Text } from '@ayzek/text';

function getAllUsage<S, R>(root: CommandNode<S, any, R>, prefix: string, node: CommandNode<S, any, R>, source: S, restricted: boolean): string[] {
	const result: Array<string> = [];
	__getAllUsage(root, node, source, result, prefix, restricted);
	return result;
}

function __getAllUsage<S, R>(root: CommandNode<S, any, R>, node: CommandNode<S, any, R>, source: S, result: string[], prefix = '', restricted: boolean) {
	if (restricted && !node.canUse(source)) {
		return;
	}

	if (node.command != null) {
		if (node.commandDescription) {
			result.push(`${prefix.trim()} — ${node.commandDescription}`);
		} else {
			result.push(prefix);
		}
	}

	if (node.redirect != null) {
		const redirect = node.redirect === root ?
			('...' + (node.commandDescription ? ` — ${node.commandDescription}` : '')) :
			'-> ' + node.redirect.usage;
		result.push(prefix.length === 0 ? ' ' + redirect : prefix + ' ' + redirect);
	} else if (node.children.length > 0) {
		for (const child of node.children) {
			__getAllUsage(root, child, source, result, prefix.length === 0 ? child.usage : prefix + ' ' + child.usage, restricted);
		}
	}
}

function addCommandPrefixes(out: string[]): string[] {
	out[0] = `⚡ ${out[0]}`;
	for (let i = 1; i < out.length; i++) {
		out[i] = `🖱 ${out[i]}`;
	}
	return out;
}

async function describePlugin(ctx: AyzekCommandContext, ayzek: Ayzek, plugin: PluginInfo): Promise<Text> {
	const availableCommands = plugin.commands?.filter(command => {
		const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal)!;
		return commandNode.canUse(ctx.source);
	});
	const additionalInfo = plugin.getHelpAdditionalInfo ? ([plugin.getHelpAdditionalInfo(ctx), '\n']) : [];
	return [
		`🔌 ${plugin.name}${plugin.category ? ` в категории ${plugin.category}` : ''}\n`,
		`🕵‍ Разработчик: ${plugin.author}\n`,
		`💬 ${plugin.description}\n`,
		additionalInfo,
		...((availableCommands && availableCommands.length > 0) ? [
			'\nСписок фич:\n',
			joinText('\n\n', [
				joinText('\n', availableCommands.map(command => {
					const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal)!;
					return [
						joinText('\n', addCommandPrefixes(getAllUsage(ayzek.commandDispatcher.root, command.literal, commandNode, ctx.source, true))),
					];
				}).map(e => e!) as any),
			].filter(e => e.length !== 0)),
		] : []),
	];
}

const requirementIsDevelopment: AyzekCommandRequirement = () => process.env.NODE_ENV === 'development';

function requireApi<T>(api: new (...args: any[]) => T): AyzekCommandRequirement {
	return source => {
		return source.api instanceof api;
	};
}

const debugCommand = command('debug')
	.thenLiteral('mentions', b => b
		.executes(ctx => [
			'User mention: ', ctx.source.user.reference, '\n',
			'Chat mention: ', ctx.source.chat?.reference ?? 'no chat',
		], 'Проверка упоминаний'),
	)
	.thenLiteral('id', b => b
		.executes(ctx => [
			`UID: ${ctx.source.user.uid}\n`,
			'CID: ', ctx.source.chat?.cid ?? 'no chat', '\n',
			`Full name: ${ctx.source.user.fullName}\n`,
			`Name: ${ctx.source.user.name}\n`,
		], 'ID юзера и чата'),
	)
	.thenLiteral('msg', b => b
		.executes(ctx => {
			const forwarded = ctx.source.maybeForwarded;
			if (!forwarded) {
				return 'No forwarded';
			}
			return [
				`UID: ${forwarded.user.uid}\n`,
				`Full name: ${forwarded.user.fullName}\n`,
			];
		}, 'Просмотр информации о пересланом сообщении'),
	)
	.thenLiteral('keyboard', b => b
		.requires(requireApi(VKApi))
		.executes(async ctx => {
			await ctx.source.send([
				'Keyboard, wow\n',
				ctx.source.isPayloadIssued ? 'Command is payload issued' : 'Command is issued by user',
			], [], {
				vkKeyboard: {
					inline: true,
					buttons: [
						[{
							action: {
								type: 'text',
								label: '🤔 Payload',
								payload: ctx.source.ayzek!.craftCommandPayload('debug keyboard'),
							},
							color: 'positive',
						}, {
							action: {
								type: 'text',
								label: '😊 Internal payload',
								payload: ctx.source.ayzek!.craftCommandPayload('debug internal-command'),
							},
							color: 'positive',
						}],
					],
				},
			} as IVKMessageOptions);
		}, 'Тест клавиатуры бота'),
	)
	.thenLiteral('internal-command', b => b
		.requires(requireHidden())
		.executes(async ctx => {
			await ctx.source.send('This command is internal!!!');
		}, "You shouldn't see this text"),
	)
	.thenLiteral('length-limit-bypass', b => b
		// 20200 chars, only in development mode
		.requires(requirementIsDevelopment)
		.executes(_ctx => ('a'.repeat(100) + ' ').repeat(200), 'Отсылает огромную строку'),
	)
	.thenLiteral('timestamp', b => b
		.executes(async _ctx => Date.now()),
	);

class PluginNameArgument extends SimpleArgumentType<string>{
	parse(_ctx: AyzekParseEntryPoint, reader: StringReader): string {
		return reader.readString();
	}

	async listSuggestions(_entry: AyzekParseEntryPoint, ctx: AyzekCommandContext, builder: SuggestionsBuilder): Promise<Suggestions> {
		const start = builder.remaining;
		for (const plugin of ctx.source.ayzek!.plugins.filter(i => i.name.startsWith(start))) {
			builder.suggest(plugin.name, plugin.description);
		}
		return builder.build();
	}

	getExamples(ctx: AyzekParseEntryPoint) {
		return ctx.source.ayzek!.plugins.map((plugin: PluginInfo) => plugin.name);
	}
}
function pluginNameArgument() {
	return new PluginNameArgument();
}

const helpCommand = command('help')
	.thenArgument('name', pluginNameArgument(), b => b
		.executes(async ctx => {
			const name = ctx.getArgument('name');
			const found = ctx.source.ayzek!.plugins.find(plugin => plugin.name === name);
			if (!found) throw new UserDisplayableError(`Неизвестное название плагина: ${name}`);
			else ctx.source.conversation.send(await describePlugin(ctx, ctx.source.ayzek!, found));
		}, 'Просмотр информации о плагине'),
	)
	.thenLiteral('all', b => b
		.executes(async ctx => {
			try {
				await ctx.source.user.send(joinText({ type: 'formatting', preserveMultipleSpaces: true, data: '\n \n \n' }, await Promise.all(ctx.source.ayzek!.plugins.map(p => describePlugin(ctx, ctx.source.ayzek!, p)))));
				if (ctx.source.conversation.isChat)
					await ctx.source.conversation.send('Помощь отправлена тебе в ЛС');
			} catch (e) {
				if (ctx.source.conversation.isChat)
					await ctx.source.conversation.send('У тебя закрыты ЛС, \n/help all отсылает ответ только туда, т.к это слишком длинное сообщение');
				else
					console.error(e.stack);
			}
		}, 'Просмотр информации о всех плагинах'),
	)
	.thenLiteral('cmd', b => b
		.thenArgument('Команда', stringArgument('greedy_phraze'), b => b
			.executes(async ctx => {
				const cmd = ctx.getArgument('Команда');
				const ayzek = ctx.source.ayzek!;
				const commandDispatcher = ayzek.commandDispatcher;
				const parsed = await commandDispatcher.parse(ctx, cmd, ctx.source);
				const node = parsed?.context.nodes[parsed?.context.nodes.length - 1];
				if (node && parsed?.reader.read) {
					return [
						joinText('\n', addCommandPrefixes(getAllUsage(commandDispatcher.root, parsed?.reader.read, node?.node, ctx.source, true))),
					];
				} else {
					return 'Команда не найдена';
				}
			}, 'Справка по команде'),
		),
	)
	.executes(async ({ source }) => {
		source.conversation.send([
			'Бот OpenSource! Исходники: https://github.com/CertainLach/AyzekReborn\n',
			'В бота установлены следующие плагины:\n\n',
			joinText('\n\n', source.ayzek!.plugins.map((plugin, i) => joinText('\n', [
				`${i + 1}. ${plugin.name} от ${plugin.author ?? 'Анонимного разработчика'}`,
				`💬 ${plugin.description ?? 'Без описания'}`,
			]))),
			'\n\nДля просмотра информации о каждом плагине пиши /help <название>, либо /help all для просмотра всех в лс',
		]);
	}, 'Показ списка плагинов');


const FIX_MAX_DISTANCE = 4;
async function getSuggestionText(ayzek: Ayzek, entry: AyzekParseEntryPoint, parsed: AyzekParseResults, source: AyzekCommandSource): Promise<Text> {
	const commandDispatcher = ayzek.commandDispatcher;
	const node = parsed.context.nodes[parsed?.context.nodes.length - 1];
	if (node) {
		return [
			'\n\n',
			joinText('\n', addCommandPrefixes(getAllUsage(commandDispatcher.root, parsed?.reader.read, node?.node, source, true))),
		];
	} else {
		const command = parsed.reader.readString();
		const literalSet = new Set();
		let possibleLiterals = [...commandDispatcher.root.literals.values()]
			.flatMap(l => l.literalNames.map(n => [l.name, n, levenshteinDistance(n, command, FIX_MAX_DISTANCE + 1)] as [string, string, number]))
			.filter((l) => l[2] <= FIX_MAX_DISTANCE)
			.sort((a, b) => a[2] - b[2])
			.filter(l => literalSet.add(l[0]));
		if (possibleLiterals.length === 0) { return []; }
		const minDistance = possibleLiterals[0][2];
		possibleLiterals = possibleLiterals.filter(literal => literal[2] < minDistance + 1.5);
		return ['\n\n', 'Возможно ты имел в виду:\n', joinText('\n', possibleLiterals.map(literal => {
			return joinText('\n', addCommandPrefixes(getAllUsage(commandDispatcher.root, literal[1], commandDispatcher.root.literals.get(literal[0])!, source, true)));
		}))];
	}
}

export default class implements PluginInfo {
	name = 'MainPlugin';
	author = 'НекийЛач';
	description = 'Плагин, содержащий некоторые команды - утилиты для управления другими плагинами';
	category = PluginCategory.UTILITY;
	commands = [debugCommand, helpCommand];
	listeners = [{
		name: 'Форматирование ошибок',
		description: 'Пишет ошибку при исполнении команд',
		type: CommandErrorEvent,
		handler: async (e: CommandErrorEvent) => {
			const parseResult = await e.event.ayzek?.commandDispatcher.parse({
				source: e.event,
			}, e.event.command, e.event);
			const suggestionText = await getSuggestionText(e.event.ayzek!, {
				source: e.event,
			}, parseResult!, e.event);
			const err = e.error;
			if (err instanceof CommandSyntaxError || err instanceof UserDisplayableError || err instanceof UnknownSomethingError) {
				await e.event.send([
					err.message,
					err.reader ? ['\n', '/', err.reader.toString()] : [],
					suggestionText,
				]);
			} else {
				// this.sendErrorFeedback(err);
				await e.event.send([
					'Произошла ошибка, репорт передан разработчику.\nПока можешь попробовать воспользоваться данными предложениями:',
					suggestionText,
				]);
			}
		},
	}];
}
