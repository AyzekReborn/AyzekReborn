import recombine from "./recombine";

describe('Recombine', () => {
	it('should perform basic operations', () => {
		expect(recombine([1, 2, 3], [4, 5, 2], v => v)).toEqual([null, 2, null]);
		expect(recombine([1, 2, 3], [1, 1, 1], v => v)).toEqual([1, null, null]);
	});
	it('should return empty array on falsy outputs', () => {
		expect(recombine([1, 2, 3], undefined, v => v)).toEqual([null, null, null]);
	});
});
