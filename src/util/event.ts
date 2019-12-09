export interface Listener<T> {
	(event: T): any;
}

export interface Disposable {
	dispose(): void;
}

export class TypedEvent<T> {
	private listeners: Listener<T>[] = [];
	private listenersOncer: Listener<T>[] = [];

	on(listener: Listener<T>): Disposable {
		this.listeners.push(listener);
		return {
			dispose: () => this.off(listener)
		};
	}

	once(listener: Listener<T>): void {
		this.listenersOncer.push(listener);
	}

	off(listener: Listener<T>) {
		var callbackIndex = this.listeners.indexOf(listener);
		if (callbackIndex > -1) this.listeners.splice(callbackIndex, 1);
	}

	emit(event: T) {
		this.listeners.forEach((listener) => listener(event));
		if (this.listenersOncer.length > 0) {
			const toCall = this.listenersOncer;
			this.listenersOncer = [];
			toCall.forEach((listener) => listener(event));
		}
	}
	pipe(te: TypedEvent<T>): Disposable {
		return this.on((e) => te.emit(e));
	}
}
