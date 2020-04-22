
// /**
//  * Fails if message sender doesn't have needed attribute
//  */
// export function requireAttribute<P extends Attribute>(constructor: AttributeConstructor<P>): Requirement<MessageEventContext<any>> {
// 	return ctx => {
// 		const attachment = ctx.event.user.attributeStorage!.getIfAvailable(constructor);
// 		return !!attachment;
// 	}
// }

// /**
//  * Fails if message sender have specified attachment
//  */
// export function requireAttachmentAbsent<P extends Attachment>(constructor: AttributeConstructor<P>): Requirement<MessageEventContext<any>> {
// 	return ctx => {
// 		const attachment = ctx.event.user.attachmentStorage!.getIfAvailable(constructor);
// 		return !attachment;
// 	}
// }
