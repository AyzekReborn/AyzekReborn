export abstract class StringifyingMap<K, V> {
	private map = new Map<string, V>();
	private keyMap = new Map<string, K>();

	has(key: K): boolean {
		let keyString = this.stringifyKey(key);
		return this.map.has(keyString);
	}
	get(key: K): V {
		let keyString = this.stringifyKey(key);
		return this.map.get(keyString);
	}
	set(key: K, value: V): StringifyingMap<K, V> {
		let keyString = this.stringifyKey(key);
		this.map.set(keyString, value);
		this.keyMap.set(keyString, key);
		return this;
	}

    /**
     * Puts new key/value if key is absent.
     * @param key key
     * @param defaultValue default value factory
     */
	putIfAbsent(key: K, defaultValue: () => V): boolean {
		if (!this.has(key)) {
			let value = defaultValue();
			this.set(key, value);
			return true;
		}
		return false;
	}

	keys(): IterableIterator<K> {
		return this.keyMap.values();
	}

	keyList(): K[] {
		return [...this.keys()];
	}

	delete(key: K): boolean {
		let keyString = this.stringifyKey(key);
		let flag = this.map.delete(keyString);
		this.keyMap.delete(keyString);
		return flag;
	}

	clear(): void {
		this.map.clear();
		this.keyMap.clear();
	}

	size(): number {
		return this.map.size;
	}

    /**
     * Turns the `key` object to a primitive `string` for the underlying `Map`
     * @param key key to be stringified
     */
	protected abstract stringifyKey(key: K): string;
}
