export type RecombineKeyExtractor<T, V> = (value: T) => V;

export default function recombine<T, V>(input: V[], output: T[], extractKey: (v: T) => V): (T | null)[] {
	let map = new Map<V, T>();
	for (let value of output)
		map.set(extractKey(value), value);
	return input.map(k => map.has(k) && map.get(k) || null);
}
