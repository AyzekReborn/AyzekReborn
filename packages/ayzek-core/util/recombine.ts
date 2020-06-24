export type RecombineKeyExtractor<T, V> = (value: T) => V;

/**
 * Extract key from output, and map output according to inputs
 */
export default function recombine<T, V>(input: V[], output: T[] | undefined, extractKey: (v: T) => V): (T | null)[] {
	const map = new Map<V, T>();
	if (!output)
		return input.map(_e => null);
	for (const value of output)
		map.set(extractKey(value), value);
	return input.map(k => map.has(k) && map.get(k) || null);
}
