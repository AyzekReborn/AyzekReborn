import { Attribute, AttributeConstructor, AttributeCreator, AttributeStorage } from '@ayzek/attribute';
import type { AyzekCommandRequirement } from '@ayzek/core/command';
import { User } from './conversation';

export abstract class RoleAttribute extends Attribute {
	public constructor(public roles: string[]) {
		super();
	}
	hasRole(role: string): boolean {
		return this.roles.includes(role);
	}
}

export abstract class RoleAttributeCreator<A extends RoleAttribute> extends AttributeCreator<User, A>{
	abstract thisConstructor: AttributeConstructor<A>;
	abstract async getAttributeFor(owner: User, storage: AttributeStorage<User>): Promise<A>;
}

export abstract class PermissionAttribute extends Attribute {
	constructor(public permissions: string[]) {
		super();
	}
	hasPermission(permission: string): boolean {
		return this.permissions.includes(permission);
	}
}

export abstract class PermissionAttributeCreator<A extends PermissionAttribute> extends AttributeCreator<User, A>{
	abstract thisConstructor: AttributeConstructor<A>;
	abstract async getAttributeFor(owner: User, storage: AttributeStorage<User>): Promise<A>;
}

export function requirePermission<P extends PermissionAttribute>(constructor: AttributeConstructor<P>, permission: string): AyzekCommandRequirement {
	return source => {
		const attribute = source.user.attributeStorage!.getIfAvailable(constructor);
		if (!attribute) return false;
		return attribute.hasPermission(permission);
	};
}

export function requireRole<P extends RoleAttribute>(constructor: AttributeConstructor<P>, role: string): AyzekCommandRequirement {
	return source => {
		const attribute = source.user.attributeStorage!.getIfAvailable(constructor);
		if (!attribute) return false;
		return attribute.hasRole(role);
	};
}
