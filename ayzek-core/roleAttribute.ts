import type { User } from "@ayzek/core/model/conversation";
import type { AyzekCommandRequirement } from "@ayzek/core/plugin";
import { Attribute, AttributeConstructor, AttributeCreator, AttributeStorage } from ".";

export abstract class RoleAttribute extends Attribute {
	public constructor(public roles: string[]) {
		super();
	}
	hasRole(role: string): boolean {
		return this.roles.includes(role);
	}
}

export abstract class RoleAttributeCreator<A extends RoleAttribute> extends AttributeCreator<User<any>, A>{
	abstract thisConstructor: AttributeConstructor<A>;
	abstract async getAttributeFor(owner: User<any>, storage: AttributeStorage<User<any>>): Promise<A>;
}

export abstract class PermissionAttribute extends Attribute {
	constructor(public permissions: string[]) {
		super();
	}
	hasPermission(permission: string): boolean {
		return this.permissions.includes(permission);
	}
}

export abstract class PermissionAttributeCreator<A extends PermissionAttribute> extends AttributeCreator<User<any>, A>{
	abstract thisConstructor: AttributeConstructor<A>;
	abstract async getAttributeFor(owner: User<any>, storage: AttributeStorage<User<any>>): Promise<A>;
}

export function requirePermission<P extends PermissionAttribute>(constructor: AttributeConstructor<P>, permission: string): AyzekCommandRequirement {
	return source => {
		const attribute = source.event.user.attributeStorage!.getIfAvailable(constructor);
		if (!attribute) return false;
		return attribute.hasPermission(permission);
	}
}

export function requireRole<P extends RoleAttribute>(constructor: AttributeConstructor<P>, role: string): AyzekCommandRequirement {
	return source => {
		const attribute = source.event.user.attributeStorage!.getIfAvailable(constructor);
		if (!attribute) return false;
		return attribute.hasRole(role);
	}
}
