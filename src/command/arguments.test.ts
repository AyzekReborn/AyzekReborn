import { stringArgument } from "./arguments";
import StringReader from "./reader";

describe('Arguments', () => {
	it('should correctly read list with separator', async () => {
		const argument = stringArgument('greedy_phraze').list({
			type: 'noSpacesWithSeparator',
		});
		expect(
			await argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello, world!'))
		)
			.toEqual(['Hello', 'world!']);
		expect(
			await argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello,world!'))
		)
			.toEqual(['Hello', 'world!']);
		expect(
			await argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello world!'))
		)
			.toEqual(['Hello']);
	});
	it('should reject if separator is located at end of all arguments', async () => {
		const argument = stringArgument('greedy_phraze').list({
			type: 'noSpacesWithSeparator',
		});
		try {
			await argument.parse({ ayzek: null, sourceProvider: null } as any,
				new StringReader('Hello,'))
		} catch {
			return;
		}
		// toBeRejectedWithError is missing in @types
		expect('').toBe('Error is not thrown somehow');
	});
});
