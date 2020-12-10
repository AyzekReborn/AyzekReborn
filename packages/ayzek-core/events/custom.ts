import { CommandMessageEvent } from './message';

// Can't use Symbols due to unstable linking
export const EVENT_ID = '-customId';

export class CommandErrorEvent {
	static [EVENT_ID] = 'ayzek:commandError';
	constructor(public event: CommandMessageEvent, public error: Error) { }
}

export type CustomEventConstructor<I> = {
	[EVENT_ID]: string,
	new(...t: any[]): I,
};
export function isCustomEventConstructor(c: CustomEventConstructor<unknown>): c is CustomEventConstructor<unknown> {
	return !!c[EVENT_ID];
}
export function isCustomEvent(c: any): boolean {
	return isCustomEventConstructor(c.constructor);
}

export enum Order {
	/**
	 * Initialisation and registration actions
	 */
	PRE = -1000,
	/**
	 * Immediate responses to actions in PRE
	 */
	AFTER_PRE = -800,
	/**
	 * Cancellation by protection plugins for informational purposes
	 */
	FIRST = -600,
	/**
	 * Standard actions that should happen before other plugins react to the event
	 */
	EARLY = -400,
	/**
	 * The default action order
	 */
	DEFAULT = 0,
	/**
	 * Standard actions that should happen after other plugins react to the event
	 */
	LATE = 400,
	/**
	 * Final cancellation by protection plugins
	 */
	LAST = 600,
	/**
	 * Actions that need to respond to cancelled events before POST
	 */
	BEFORE_POST = 800,
	/**
	 * Actions that need to react to the final and stable effects of event
	 */
	POST = 1000,
}

export interface Listener<T> {
	(event: T): any;
}

export interface Disposable {
	dispose(): void;
}

export class TypedEvent<T> {
	private listeners: [Listener<T>, number][] = [];
	private listenersOncer: Listener<T>[] = [];

	on(listener: Listener<T>, order = Order.DEFAULT): Disposable {
		this.listeners.push([listener, order]);
		this.listeners.sort((a, b) => a[1] - b[1]);
		return {
			dispose: () => this.off(listener),
		};
	}

	once(listener: Listener<T>): void {
		this.listenersOncer.push(listener);
	}

	off(listener: Listener<T>) {
		const callbackIndex = this.listeners.findIndex(l => l[0] === listener);
		if (callbackIndex > -1) this.listeners.splice(callbackIndex, 1);
	}

	emit(event: T) {
		this.listeners.forEach((listener) => listener[0](event));
		if (this.listenersOncer.length > 0) {
			const toCall = this.listenersOncer;
			this.listenersOncer = [];
			toCall.forEach((listener) => listener(event));
		}
	}
	pipe(te: TypedEvent<T>, order = Order.DEFAULT): Disposable {
		return this.on((e) => te.emit(e), order);
	}
}


type PipeDesc = [CustomEventBus, Disposable[]];

export class CustomEventBus {
	private eventHandlers = new Map<string, TypedEvent<unknown>>();
	private pipedTo: PipeDesc[] = [];

	private getHandlersById(id: string): TypedEvent<unknown> {
		let event = this.eventHandlers.get(id);
		if (!event) {
			event = new TypedEvent();
			for (const piped of this.pipedTo) {
				piped[1].push(event.pipe(piped[0].getHandlersById(id)));
			}
			this.eventHandlers.set(id, event);
		}
		return event;
	}
	getHandlers<S>(t: CustomEventConstructor<S>): TypedEvent<S> {
		if (!isCustomEventConstructor(t)) throw new Error('Expected event constructor');
		return this.getHandlersById(t[EVENT_ID]) as TypedEvent<S>;
	}
	on<S>(t: CustomEventConstructor<S>, handler: (event: S) => void, order = Order.DEFAULT): Disposable {
		this.getHandlers(t).on(handler, order);
		return {
			dispose: () => {
				this.getHandlers(t).off(handler);
			},
		};
	}
	off<S>(t: CustomEventConstructor<S>, handler: (event: S) => void) {
		this.getHandlers(t).off(handler);
	}
	emit<I, E extends CustomEventConstructor<I>>(event: I) {
		if (!isCustomEvent(event)) throw new Error('Expected custom event');
		this.getHandlersById((event as any).constructor[EVENT_ID]).emit(event);
	}

	pipe(bus: CustomEventBus, order = Order.DEFAULT): Disposable {
		const disposables: Disposable[] = [];
		const thisPipeDesc: PipeDesc = [bus, disposables];
		this.pipedTo.push(thisPipeDesc);
		for (const eventId of this.eventHandlers.keys()) {
			const disposable = this.getHandlersById(eventId).pipe(bus.getHandlersById(eventId) as TypedEvent<any>, order);
			disposables.push(disposable);
		}
		return {
			dispose: () => {
				for (const disposable of disposables)
					disposable.dispose();
				this.pipedTo.splice(this.pipedTo.indexOf(thisPipeDesc), 1);
			},
		};
	}
}
