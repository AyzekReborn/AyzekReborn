export default abstract class PromiseMap<K, V> {
	protected abstract getPromise(key: K): Promise<V | null>;
	private map: Map<K, Promise<V | null>> = new Map();
	get(key: K): Promise<V | null> {
		if (!this.map.has(key)) {
			const promise = this.getPromise(key);
			this.map.set(key, promise);
			promise.catch(_e => {
				this.map.delete(key);
			});
		}
		return this.map.get(key)!;
	}
}
