import { stringArgument, listArgument } from "./arguments";
import StringReader from "./reader";

describe('Arguments', () => {
	it('should correctly read list with separator', () => {
		const argument = listArgument(stringArgument('greedy_phraze'), { type: 'withSeparator' }, 1, 20);
		expect(
			argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello, world!'))
		)
			.toEqual(['Hello', 'world!']);
		expect(
			argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello,world!'))
		)
			.toEqual(['Hello', 'world!']);
		expect(
			argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello world!'))
		)
			.toEqual(['Hello']);
	});
	it('should reject if separator is located at end of all arguments', async () => {
		const argument = listArgument(stringArgument('greedy_phraze'), { type: 'withSeparator' }, 1, 20);
		expect(() => {
			argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello,'))
		}).toThrow();
	});
});
