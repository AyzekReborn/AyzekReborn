import VKApi, { IVKMessageOptions } from '@ayzek/api-vk';
import { SimpleArgumentType } from '@ayzek/command-parser/arguments';
import { CommandSyntaxError, UnknownSomethingError, UserDisplayableError } from '@ayzek/command-parser/error';
import type StringReader from '@ayzek/command-parser/reader';
import type { Requirement } from '@ayzek/command-parser/requirement';
import type { Suggestions, SuggestionsBuilder } from '@ayzek/command-parser/suggestions';
import type { Ayzek } from '@ayzek/core/ayzek';
import { AyzekCommandContext, AyzekCommandRequirement, AyzekCommandSource, AyzekParseEntryPoint, AyzekParseResults } from '@ayzek/core/command';
import { CommandErrorEvent } from '@ayzek/core/events/custom';
import { command, PluginCategory, PluginInfo } from '@ayzek/core/plugin';
import { requireHidden } from '@ayzek/core/requirements';
import { exclude } from '@ayzek/core/util/array';
import { levenshteinDistance } from '@ayzek/core/util/levenshtein';
import { padList } from '@ayzek/core/util/pad';
import { joinText, Text } from '@ayzek/text';

function padAllListItemExceptFirst(list: string[]) {
	return [
		list[0],
		...padList(list.slice(1), '      '),
	];
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
						`⚡ /${command.literal} `,
						{
							type: 'formatting',
							preserveMultipleSpaces: true,
							data: joinText('\n', padAllListItemExceptFirst(ayzek.commandDispatcher.getAllUsage(commandNode, ctx.source, true))),
						} as Text,
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


const FIX_MAX_DISTANCE = 3;
async function getSuggestionText(ayzek: Ayzek, entry: AyzekParseEntryPoint, parseResult: AyzekParseResults, source: AyzekCommandSource): Promise<Text> {
	const suggestionListNextCommand = [];
	let suggestionList = [];
	let possibleFixes: string[] = [];
	const suggestionThisArgument = [];
	if (parseResult.reader.string.length === parseResult.reader.cursor) {
		const oldString = parseResult.reader.string;
		const oldCursor = parseResult.reader.cursor;
		parseResult.reader.string += ' ';
		parseResult.reader.cursor++;
		const suggestions = await ayzek.commandDispatcher.getCompletionSuggestions(entry, parseResult as any, parseResult.reader.cursor, source as any);
		for (const suggestion of suggestions.suggestions) {
			suggestionListNextCommand.push(`${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim());
		}
		parseResult.reader.string = oldString;
		parseResult.reader.cursor = oldCursor;
	}
	{
		const parsedSuccessfully = parseResult.exceptions.size === 0;
		const neededCursor = parsedSuccessfully ? (() => {
			return parseResult.context.nodes[parseResult.context.nodes.length - 1]?.range.start ?? 0;
		})() : parseResult.reader.cursor;
		const currentArgument = parseResult.reader.string.slice(neededCursor);
		const suggestions = await ayzek.commandDispatcher.getCompletionSuggestions(entry, parseResult, neededCursor, source);
		const possibleFixesUnsorted: [string, number][] = [];
		for (const suggestion of suggestions.suggestions) {
			const text = `${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim();
			suggestionList.push(text);
			const distance = levenshteinDistance(suggestion.text, currentArgument, FIX_MAX_DISTANCE);
			if (distance <= FIX_MAX_DISTANCE) {
				possibleFixesUnsorted.push([text, distance]);
			}
		}
		possibleFixes = possibleFixesUnsorted.sort((a, b) => a[1] - b[1]).map(f => f[0]);
	}
	{
		const oldCursor = parseResult.reader.cursor;
		parseResult.reader.cursor = parseResult.reader.string.length;
		const suggestions = await ayzek.commandDispatcher.getCompletionSuggestions(entry, parseResult, parseResult.reader.cursor, source);
		for (const suggestion of suggestions.suggestions) {
			suggestionThisArgument.push(`${suggestion.text} ${suggestion.tooltip === null ? '' : `(${suggestion.tooltip})`}`.trim());
		}
		parseResult.reader.cursor = oldCursor;
	}

	possibleFixes = exclude(possibleFixes, suggestionThisArgument);
	suggestionList = exclude(suggestionList, possibleFixes, suggestionThisArgument);

	const suggestionText = [
		suggestionListNextCommand.length === 0 ? [] : [
			'\n\n',
			'Пример того, что можно поставить следующей командой:\n',
			suggestionListNextCommand.join(', '),
		],
		suggestionThisArgument.length === 0 ? [] : [
			'\n\n',
			'Пример того, как можно продолжить текущий аргумент:\n',
			suggestionThisArgument.join(', '),
		],
		possibleFixes.length === 0 ? [] : [
			'\n\n',
			'Возможно ты имел в виду:\n',
			possibleFixes.join(', '),
		],
		suggestionList.length === 0 ? [] : [
			'\n\n',
			'Пример того, что ещё можно поставить в этом месте:\n',
			suggestionList.join(', '),
		],
	].filter(e => e.length !== 0);

	return suggestionText;
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
