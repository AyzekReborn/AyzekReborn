export type MaybePromise<T> = Promise<T> | T;

export function isPromise<T>(val: MaybePromise<T>): val is Promise<T> {
	return val instanceof Promise;
}

/**
 * Simple, never expiring in-memory cache
 */
export default abstract class PromiseMap<K, V> {
	protected abstract getPromise(key: K): Promise<V | null>;

	protected normalizeKey: ((key: K) => K) | null = null;
	protected normalizeValue: ((value: V) => V) | null = null;

	protected map: Map<K, Promise<V | null>> = new Map();
	protected resolvedMap: Map<K, V | null> = new Map();

	getIfResolvedPresent(key: K): V | null {
		if (this.normalizeKey) key = this.normalizeKey(key);
		return this.resolvedMap.get(key) ?? null;
	}

	getIfResolvingOrResolvedPresent(key: K): MaybePromise<V | null> {
		if (this.normalizeKey) key = this.normalizeKey(key);
		const resolved = this.resolvedMap.get(key);
		if (resolved) return resolved;
		const resolving = this.map.get(key);
		if (resolving) return resolving;
		return null;
	}

	delete(key: K): boolean {
		if (this.normalizeKey) key = this.normalizeKey(key);
		return this.map.delete(key) || this.resolvedMap.delete(key);
	}

	getAll: (keys: K[]) => MaybePromise<(V | null)[]> = this._getAll;

	/**
	 * Works great with collapsing queue
	 *
	 * @param keys
	 */
	protected _getAll(keys: K[]): MaybePromise<(V | null)[]> {
		const promises: Promise<void>[] = [];
		const results: (V | null | undefined)[] = new Array(keys.length);
		for (let i = 0; i < keys.length; i++) {
			let key = keys[i];
			if (this.normalizeKey) key = this.normalizeKey(key);
			results[i] = this.resolvedMap.get(key);
			if (results[i] === undefined) {
				promises.push((this.get(key) as Promise<V | null>).then(v => {
					results[i] = v;
				}));
			}
		}
		if (promises.length === 0)
			return results as (V | null)[];
		return Promise.all(promises).then(() => results as (V | null)[]);
	}

	get: (key: K) => MaybePromise<V | null> = this._get;

	protected _get(key: K): MaybePromise<V | null> {
		if (this.normalizeKey) key = this.normalizeKey(key);
		if (this.resolvedMap.has(key))
			return this.resolvedMap.get(key)!;
		if (!this.map.has(key)) {
			const promise = this.getPromise(key).then(v => (v !== null && this.normalizeValue) ? this.normalizeValue(v) : v);
			this.map.set(key, promise);
			promise.then(v => {
				this.map.delete(key);
				this.resolvedMap.set(key, v);
			});
			promise.catch(_e => {
				this.map.delete(key);
			});
		}
		return this.map.get(key)!;
	}
}
