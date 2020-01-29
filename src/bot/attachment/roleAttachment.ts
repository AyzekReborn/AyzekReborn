import { User } from "../../model/conversation";
import { Attachment, AttachmentConstructor, AttachmentCreator, AttachmentStorage } from "./attachment";
import { AyzekCommandRequirement } from "../plugin";

export abstract class RoleAttachment extends Attachment {
	public constructor(public roles: string[]) {
		super();
	}
	hasRole(role: string): boolean {
		return this.roles.includes(role);
	}
}

export abstract class RoleAttachmentCreator<A extends RoleAttachment> extends AttachmentCreator<User<any>, A>{
	abstract thisConstructor: AttachmentConstructor<A>;
	abstract async getAttachmentFor(owner: User<any>, storage: AttachmentStorage<User<any>>): Promise<A>;
}

export abstract class PermissionAttachment extends Attachment {
	constructor(public permissions: string[]) {
		super();
	}
	hasPermission(permission: string): boolean {
		return this.permissions.includes(permission);
	}
}

export abstract class PermissionAttachmentCreator<A extends PermissionAttachment> extends AttachmentCreator<User<any>, A>{
	abstract thisConstructor: AttachmentConstructor<A>;
	abstract async getAttachmentFor(owner: User<any>, storage: AttachmentStorage<User<any>>): Promise<A>;
}

export function requirePermission<P extends PermissionAttachment>(constructor: AttachmentConstructor<P>, permission: string): AyzekCommandRequirement {
	return source => {
		const attachment = source.event.user.attachmentStorage!.getIfAvailable(constructor);
		if (!attachment) return false;
		return attachment.hasPermission(permission);
	}
}

export function requireRole<P extends RoleAttachment>(constructor: AttachmentConstructor<P>, role: string): AyzekCommandRequirement {
	return source => {
		const attachment = source.event.user.attachmentStorage!.getIfAvailable(constructor);
		if (!attachment) return false;
		return attachment.hasRole(role);
	}
}
