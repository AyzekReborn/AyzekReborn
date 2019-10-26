import { extractMax, extractMaxChars, extractMaxPossiblePart, splitByMaxPossibleParts } from './split';
describe('Splits', () => {
	it('should extract max lines', () => {
		expect(extractMax('hello\nwo', 5, '\n')[0]).toEqual('hello');
		expect(extractMax('hello\nwo', 8, '\n')[0]).toEqual('hello\nwo');
		expect(extractMax('hello\nwo', 7, '\n')[0]).toEqual('hello');
		expect(extractMax('hello\nwor', 8, '\n')[0]).toEqual('hello');
		expect(extractMax('helloworl', 8, '\n')[0]).toEqual(null);
	});
	it('should extract max words', () => {
		expect(extractMax('hello wo', 5, ' ')[0]).toEqual('hello');
		expect(extractMax('hello wo', 8, ' ')[0]).toEqual('hello wo');
		expect(extractMax('hello wo', 7, ' ')[0]).toEqual('hello');
		expect(extractMax('hello wor', 8, ' ')[0]).toEqual('hello');
		expect(extractMax('helloworl', 8, ' ')[0]).toEqual(null);
	});
	it('should extract max chars', () => {
		expect(extractMaxChars('hello wo', 7)[0]).toEqual('hello w');
	});
	it('should extract max possible part', () => {
		expect(extractMaxPossiblePart('hello world\nhello world', 23)[0]).toEqual('hello world\nhello world');
		expect(extractMaxPossiblePart('hello world\nhello world', 22)[0]).toEqual('hello world');
		expect(extractMaxPossiblePart('hello world\nhello world', 10)[0]).toEqual('hello');
		expect(extractMaxPossiblePart('hello world\nhello world', 5)[0]).toEqual('hello');
		expect(extractMaxPossiblePart('hello world\nhello world', 4)[0]).toEqual('hell');
	});
	it('should split by max possible part', () => {
		expect(splitByMaxPossibleParts('hell\nworld\nhel loworld\nqwe', 6)).toEqual([
			'hell',
			'world',
			'hel',
			'loworl',
			'd\nqwe'
		]);
	});
});
