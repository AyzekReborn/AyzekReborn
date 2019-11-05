import { Attachment, AttachmentCreator, AttachmentStorage, AttachmentConstructor } from "./attachment";
import { User } from "../../model/conversation";
import { Requirement } from "../../command/requirement";
import { MessageEventContext } from "../context";

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

export function requirePermission<P extends PermissionAttachment>(constructor: AttachmentConstructor<P>, permission: string): Requirement<MessageEventContext<any>> {
	return ctx => {
		const attachment = ctx.event.user.attachmentStorage!.get(constructor);
		return attachment.hasPermission(permission);
	}
}

export function requireRole<P extends RoleAttachment>(constructor: AttachmentConstructor<P>, role: string): Requirement<MessageEventContext<any>> {
	return ctx => {
		const attachment = ctx.event.user.attachmentStorage!.get(constructor);
		return attachment.hasRole(role);
	}
}
