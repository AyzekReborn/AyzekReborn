import { Requirement } from "../../command/requirement";
import { MessageEventContext } from "../context";

class DependencyResolutionErrors extends Error {
	constructor(public constructor: AttachmentConstructor<any>, public reasons: Error[]) {
		super(`Failed to resolve dependencies for ${constructor.name}`);
		this.name = 'DependencyResolutionErrors';
		// TODO: This works, but this is are not best practice
		reasons.forEach((r, i) => {
			this.stack += `\nReason ${i}: ${r.stack}`;
		});
	}
}
class DependencyNotFoundErrors extends Error {
	constructor(public constructor: AttachmentConstructor<any>, public missing: AttachmentConstructor<any>[]) {
		super(`Failed to find dependencies (Cyclic dependency probally?) for ${constructor.name}: ${missing.map(d => d.name)}`);
		this.name = 'DependencyNotFoundErrors';
	}
}
class UnknownDependencyError extends Error {
	constructor(public constructor: AttachmentConstructor<any>) {
		super(`Unknown dependency: ${constructor.name}`);
		this.name = 'UnknownDependencyError';
	}
}

export class AttachmentRepository<O> {
	private creators: AttachmentCreator<O, any>[] = [];
	addCreator(creator: AttachmentCreator<O, any>) {
		this.creators.push(creator);
	}
	removeCreator(creator: AttachmentCreator<O, any>) {
		this.creators.splice(this.creators.indexOf(creator), 1);
	}
	async getStorageFor(owner: O): Promise<AttachmentStorage<O>> {
		const storage = new AttachmentStorage(owner, new Set(this.creators));
		await storage.fill();
		return storage;
	}
}

// TODO: Build dependency graph instead of brute-forcing creator list, or, at
// TODO: least, trace&cache resulution path
export class AttachmentStorage<O> {
	resolved: Map<AttachmentConstructor<any>, Attachment> = new Map();
	resolutionErrors: Map<AttachmentConstructor<any>, Error> = new Map();
	constructor(private owner: O, private remainingCreators: Set<AttachmentCreator<O, any>>) { }
	async fill() {
		while (this.remainingCreators.size !== 0) {
			let resolvedOnThisStep = 0;
			for (let creator of this.remainingCreators) {
				const depencencyErrors = getDependencyErrors(creator, this);
				if (depencencyErrors.length !== 0) {
					this.resolutionErrors.set(creator.thisConstructor, new DependencyResolutionErrors(creator.thisConstructor, depencencyErrors))
					this.remainingCreators.delete(creator);
				} else if (isCreatorHaveAllDependenciesResolved(creator, this)) {
					try {
						this.resolved.set(creator.thisConstructor, await creator.getAttachmentFor(this.owner, this));
					} catch (e) {
						this.resolutionErrors.set(creator.thisConstructor, e);
					}
					this.remainingCreators.delete(creator);
				}
				resolvedOnThisStep++;
			}
			if (resolvedOnThisStep === 0) {
				for (let creator of this.remainingCreators) {
					this.resolutionErrors.set(creator.thisConstructor, new DependencyNotFoundErrors(creator.thisConstructor, getMissingDependencies(creator, this)));
					this.remainingCreators.delete(creator);
				}
				return;
			}
		}
	}
	get<A extends Attachment>(constructor: AttachmentConstructor<A>): A {
		if (this.resolutionErrors.has(constructor))
			throw this.resolutionErrors.get(constructor);
		if (this.resolved.has(constructor))
			return this.resolved.get(constructor)! as A;
		throw new UnknownDependencyError(constructor);
	}
	getIfAvailable<A extends Attachment>(constructor: AttachmentConstructor<A>): A | null {
		if (this.resolved.has(constructor))
			return this.resolved.get(constructor)! as A;
		return null;
	}
}

export const ownerlessEmptyAttachmentStorage = new AttachmentStorage<any>(null, new Set())

function getDependencyErrors(creator: AttachmentCreator<any, any>, storage: AttachmentStorage<any>): Error[] {
	return creator.dependencies.map(e => storage.resolutionErrors.get(e)).filter(e => e !== undefined).map(e => e!);
}

function getMissingDependencies(creator: AttachmentCreator<any, any>, storage: AttachmentStorage<any>): AttachmentConstructor<any>[] {
	return creator.dependencies.filter(e => !storage.resolved.has(e) || storage.resolutionErrors.has(e));
}

function isCreatorHaveAllDependenciesResolved(creator: AttachmentCreator<any, any>, storage: AttachmentStorage<any>): boolean {
	if (creator.dependencies.length === 0) return true;
	return creator.dependencies.every(d => storage.resolved.has(d));
}

export abstract class Attachment { }

export type AttachmentConstructor<A extends Attachment> = new (...args: any[]) => A;

export abstract class AttachmentCreator<O, A extends Attachment> {
	abstract thisConstructor: AttachmentConstructor<A>;
	abstract dependencies: AttachmentConstructor<any>[];
	abstract async getAttachmentFor(owner: O, storage: AttachmentStorage<O>): Promise<A>;
}

export function requireAttachment<P extends Attachment>(constructor: AttachmentConstructor<P>, role: string): Requirement<MessageEventContext<any>> {
	return ctx => {
		const attachment = ctx.event.user.attachmentStorage!.getIfAvailable(constructor);
		return !!attachment;
	}
}
