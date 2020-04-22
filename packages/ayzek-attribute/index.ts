class DependencyResolutionErrors extends Error {
	constructor(public builder: AttributeConstructor<any>, public reasons: Error[]) {
		super(`Failed to resolve dependencies for ${builder.name}`);
		this.name = 'DependencyResolutionErrors';
		// TODO: This works, but this is are not best practice
		reasons.forEach((r, i) => {
			this.stack += `\nReason ${i}: ${r.stack}`;
		});
	}
}
class DependencyNotFoundErrors extends Error {
	constructor(public builder: AttributeConstructor<any>, public missing: AttributeConstructor<any>[]) {
		super(`Failed to find dependencies (Cyclic dependency probally?) for ${builder.name}: ${missing.map(d => d.name)}`);
		this.name = 'DependencyNotFoundErrors';
	}
}
class UnknownDependencyError extends Error {
	constructor(public builder: AttributeConstructor<any>) {
		super(`Unknown dependency: ${builder.name}`);
		this.name = 'UnknownDependencyError';
	}
}

/**
 * Holds all attachment creators and can issue
 * new attachment storage for specified owner
 */
export class AttributeRepository<O> {
	private creators: AttributeCreator<O, any>[] = [];
	addCreator(creator: AttributeCreator<O, any>) {
		this.creators.push(creator);
	}
	removeCreator(creator: AttributeCreator<O, any>) {
		this.creators.splice(this.creators.indexOf(creator), 1);
	}
	async getStorageFor(owner: O): Promise<AttributeStorage<O>> {
		if (this.creators.length === 0) return ownerlessEmptyAttributeStorage;
		const storage = new AttributeStorage(owner, new Set(this.creators));
		await storage.fill();
		return storage;
	}
}

/**
 * Contains all attributes for user, can handle dependencies
 *
 * TODO: Build dependency graph instead of brute-forcing creator list, or, at
 * TODO: least, trace&cache resolution path
 */
export class AttributeStorage<O> {
	resolved: Map<AttributeConstructor<any>, Attribute> = new Map();
	resolutionErrors: Map<AttributeConstructor<any>, Error> = new Map();
	constructor(private owner: O, private remainingCreators: Set<AttributeCreator<O, any>>) { }
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
						this.resolved.set(creator.thisConstructor, await creator.getAttributeFor(this.owner, this));
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
	/**
	 * Gets attachment by constructor, throws if attachment is
	 * failed to resolve or doesn't exits
	 */
	get<A extends Attribute>(constructor: AttributeConstructor<A>): A {
		if (this.resolutionErrors.has(constructor))
			throw this.resolutionErrors.get(constructor);
		if (this.resolved.has(constructor))
			return this.resolved.get(constructor)! as A;
		throw new UnknownDependencyError(constructor);
	}

	/**
	 * Returns attachment if available, null otherwise
	 */
	getIfAvailable<A extends Attribute>(constructor: AttributeConstructor<A>): A | null {
		if (this.resolved.has(constructor))
			return this.resolved.get(constructor)! as A;
		return null;
	}
}

// Used when no attributes is attached
export const ownerlessEmptyAttributeStorage = new AttributeStorage<any>(null, new Set())

function getDependencyErrors(creator: AttributeCreator<any, any>, storage: AttributeStorage<any>): Error[] {
	return creator.dependencies.map(e => storage.resolutionErrors.get(e)).filter(e => e !== undefined).map(e => e!);
}

function getMissingDependencies(creator: AttributeCreator<any, any>, storage: AttributeStorage<any>): AttributeConstructor<any>[] {
	return creator.dependencies.filter(e => !storage.resolved.has(e) || storage.resolutionErrors.has(e));
}

function isCreatorHaveAllDependenciesResolved(creator: AttributeCreator<any, any>, storage: AttributeStorage<any>): boolean {
	if (creator.dependencies.length === 0) return true;
	return creator.dependencies.every(d => storage.resolved.has(d));
}

/**
 * Any set of probally persistent values/methods attached to user/chat
 */
export abstract class Attribute { }

export type AttributeConstructor<A extends Attribute> = new (...args: any[]) => A;

export abstract class AttributeCreator<O, A extends Attribute> {
	abstract thisConstructor: AttributeConstructor<A>;
	abstract dependencies: AttributeConstructor<any>[];
	/**
	 * Constructs attribute for specified owner, receiving all needed dependencies in storage argument
	 *
	 * @remarks
	 * This method is never called if any of dependency resolution is failed
	 *
	 * @param owner attribute owner
	 * @param storage holds resolved dependencies
	 *
	 * @returns constructed attribute
	 */
	abstract async getAttributeFor(owner: O, storage: AttributeStorage<O>): Promise<A>;
}
