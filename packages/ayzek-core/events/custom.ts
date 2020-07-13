import { Disposable, TypedEvent } from '@meteor-it/utils';
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
	on<S>(t: CustomEventConstructor<S>, handler: (event: S) => void): Disposable {
		this.getHandlers(t).on(handler);
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

	pipe(bus: CustomEventBus): Disposable {
		const disposables: Disposable[] = [];
		const thisPipeDesc: PipeDesc = [bus, disposables];
		this.pipedTo.push(thisPipeDesc);
		for (const eventId of this.eventHandlers.keys()) {
			const disposable = this.getHandlersById(eventId).pipe(bus.getHandlersById(eventId) as TypedEvent<any>);
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
