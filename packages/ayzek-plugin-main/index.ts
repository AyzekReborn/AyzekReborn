import VKApi, { IVKMessageOptions } from '@ayzek/api-vk';
import { AttributeCreator } from '@ayzek/attribute';
import { SimpleArgumentType, stringArgument } from '@ayzek/command-parser/arguments';
import { CommandSyntaxError, UnknownSomethingError, UserDisplayableError } from '@ayzek/command-parser/error';
import type StringReader from '@ayzek/command-parser/reader';
import type { Suggestions, SuggestionsBuilder } from '@ayzek/command-parser/suggestions';
import { CommandNode } from '@ayzek/command-parser/tree';
import type { Ayzek } from '@ayzek/core/ayzek';
import { AyzekCommandContext, AyzekCommandRequirement, AyzekCommandSource, AyzekParseEntryPoint, AyzekParseResults } from '@ayzek/core/command';
import { Chat, Conversation, User } from '@ayzek/core/conversation';
import { CommandErrorEvent } from '@ayzek/core/events/custom';
import { ApplyChatLocaleEvent, ApplyUserLocaleEvent } from '@ayzek/core/events/locale';
import { command, PluginBase as PluginBase, PluginCategory } from '@ayzek/core/plugin';
import { requireHidden } from '@ayzek/core/requirements';
import { levenshteinDistance } from '@ayzek/core/util/levenshtein';
import { FormattingTextPart, joinText, Locale, T, Text } from '@ayzek/text';
import { LANGUAGES } from '@ayzek/text/language';
import { LOCALES } from '@ayzek/text/locale';

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

async function describePlugin(t: T, ctx: AyzekCommandContext, ayzek: Ayzek, plugin: PluginBase): Promise<Text> {
	const availableCommands = plugin.resolvedCommands?.filter(command => {
		const commandNode = ayzek.commandDispatcher.root.literals.get(command.literal)!;
		return commandNode.canUse(ctx.source);
	});
	const additionalInfo = plugin.getHelpAdditionalInfo ? ([await plugin.getHelpAdditionalInfo(ctx), '\n']) : [];
	return [
		`🔌 ${plugin.name}\n`,
		'🕵‍ ', t`Developer:`, ` ${plugin.author}\n`,
		`💬 ${plugin.description}\n`,
		additionalInfo,
		...((availableCommands && availableCommands.length > 0) ? [
			'\n', t`Feature list:`, '\n',
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
		return ctx.source.ayzek!.plugins.map((plugin: PluginBase) => plugin.name);
	}
}
function pluginNameArgument() {
	return new PluginNameArgument();
}

const helpCommand = ({ t }: Plugin) => command('help')
	.thenArgument('name', pluginNameArgument(), b => b
		.executes(async ctx => {
			const name = ctx.getArgument('name');
			const found = ctx.source.ayzek!.plugins.find(plugin => plugin.name === name);
			if (!found) throw new UserDisplayableError(`Неизвестное название плагина: ${name}`);
			else ctx.source.conversation.send(await describePlugin(t, ctx, ctx.source.ayzek!, found));
		}, 'Просмотр информации о плагине'),
	)
	.thenLiteral('all', b => b
		.executes(async ctx => {
			try {
				await ctx.source.user.send(joinText(new FormattingTextPart('\n\n\n', { preserveMultipleSpaces: true }), await Promise.all(ctx.source.ayzek!.plugins.map(p => describePlugin(t, ctx, ctx.source.ayzek!, p)))));
				if (ctx.source.conversation.isChat)
					await ctx.source.conversation.send(t`Output of this command is big, so it being sent to PM`);
			} catch (e) {
				if (ctx.source.conversation.isChat)
					await ctx.source.conversation.send(t`You have closed PMs,\n/help all can't answer in chat because of very big output`);
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
					return t`Command not found`;
				}
			}, 'Справка по команде'),
		),
	)
	.executes(async ({ source }) => {
		source.conversation.send([
			t`This bot source code located at github: https://github.com/CertainLach/AyzekReborn`, '\n',
			t`Installed plugins:`, '\n\n',
			joinText('\n\n', source.ayzek!.plugins.map((plugin, i) => joinText('\n', [
				[`${i + 1}. `, t`${/*plugin name*/plugin.name} by ${/*plugin developer*/plugin.author ?? t/*author name shown by default*/`Anonymous developer`}`],
				`💬 ${plugin.description ?? t`No description`}`,
			]))),
			'\n\n',
			t`For plugin info see "/help <name>", or "/help all" to see all plugins`,
		]);
	}, 'Показ списка плагинов');


const FIX_MAX_DISTANCE = 4;
async function getSuggestionText(t: T, ayzek: Ayzek, _entry: AyzekParseEntryPoint, parsed: AyzekParseResults, source: AyzekCommandSource): Promise<Text> {
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
		return ['\n\n', t`Probally you meant:`, '\n', joinText('\n', possibleLiterals.map(literal => {
			return joinText('\n', addCommandPrefixes(getAllUsage(commandDispatcher.root, literal[1], commandDispatcher.root.literals.get(literal[0])!, source, true)));
		}))];
	}
}

const errorFormattingListener = ({ t }: Plugin) => ({
	name: 'Форматирование ошибок',
	description: 'Пишет ошибку при исполнении команд',
	type: CommandErrorEvent,
	handler: async (e: CommandErrorEvent) => {
		const parseResult = await e.event.ayzek?.commandDispatcher.parse({
			source: e.event,
		}, e.event.command, e.event);
		const suggestionText = await getSuggestionText(t, e.event.ayzek!, {
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
				[t`Something is broken, this issue was reported to developer.\nYou can use those suggestions in meantime:`],
				suggestionText,
			]);
		}
	},
});

const localeSettingListener = ({
	name: 'Locale setting',
	description: 'Sets user locale',
	type: ApplyUserLocaleEvent,
	handler: async (e: ApplyUserLocaleEvent) => {
		if (!e.user.locale)
			e.user.locale = new Locale(LANGUAGES.ru, LOCALES.RU, {});
	},
});
const chatLocaleSettingListener = ({
	name: 'Locale setting',
	description: 'Sets chat locale',
	type: ApplyChatLocaleEvent,
	handler: async (e: ApplyChatLocaleEvent) => {
		if (!e.chat.locale)
			e.chat.locale = new Locale(LANGUAGES.ru, LOCALES.RU, {});
	},
});

export default class Plugin extends PluginBase {
	userAttributes?: AttributeCreator<User<unknown>, any>[] | undefined;
	chatAttributes?: AttributeCreator<Chat<unknown>, any>[] | undefined;
	conversationAttributes?: AttributeCreator<Conversation, any>[] | undefined;
	ayzekAttributes?: AttributeCreator<Ayzek, any>[] | undefined;
	name = 'MainPlugin';
	author = 'НекийЛач';
	description = 'Плагин, содержащий некоторые команды - утилиты для управления другими плагинами';
	category = PluginCategory.UTILITY;

	commands = [debugCommand, helpCommand];

	listeners = [errorFormattingListener, localeSettingListener, chatLocaleSettingListener];

	translations = require.context('./translations', false, /\.json$/);
}
