import { stringArgument } from '@ayzek/command-parser/arguments';
import { command } from '@ayzek/core/plugin';
import { requireChat } from '@ayzek/core/requirements';
import Random from '@meteor-it/random';
import { ListVariant, RandomItemVariant, RandomUserVariant } from './variant';

const WHO_RESULT = new RandomItemVariant([
	new ListVariant([
		new RandomItemVariant([
			'Волшебный шар',
			'Бог-император',
			'Путин',
			'Каждый третий японец',
			'Ктулху',
			'Я задал этот вопрос другому боту, и он',
			'Магия воды',
			'Админ вк',
			new RandomItemVariant([
				'█████████',
				'████',
				'█████',
			]),
			new RandomUserVariant(),
		]),
		' ',
		new RandomItemVariant([
			'говорит, что это',
			'намекает мне на то, что это может быть',
			'думает, что это',
			'утверждает, что это',
		]),
		' ',
		new RandomUserVariant(),
	]),
	new ListVariant([
		new RandomItemVariant(['Я думаю что это',
			'Стопудов',
			'Это',
			new ListVariant([
				'Если это не ',
				new RandomItemVariant([
					'ты',
					new RandomUserVariant(),
				]),
				', то только',
			]),
		]),
		' ',
		new RandomUserVariant(),
	]),
]);

export const whoCommand = command('who')
	.thenArgument('Действие', stringArgument('greedy_phraze'), b => b
		.requires(requireChat())
		.executes(async ctx => {
			const dateSeed = Math.ceil(Date.now() / (1000 * 60 * 60));
			const random = new Random(`${ctx.getArgument('Действие')}:${dateSeed}`);
			return WHO_RESULT.getValue(random, ctx.source.chat!);
		}, 'Определение, кто из чата исполняет выбранное действие'),
	);
