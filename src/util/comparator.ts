type Comparator<T> = (a: T, b: T) => number; // -1 | 0 | 1

export function invert<T>(comparator: Comparator<T>): Comparator<T> {
	return (a, b) => comparator(b, a);
}

export function chain<T>(...comparators: Comparator<T>[]): Comparator<T> {
	return (a: T, b: T) => {
		let order = 0;
		let i = 0;

		while (!order && comparators[i]) {
			order = comparators[i++](a, b);
		}

		return order;
	};
}
