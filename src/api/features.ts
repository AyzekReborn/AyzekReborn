import { MessageEventContext } from "../bot/context";
import { Api } from "../model/api";
import { Requirement } from "../command/requirement";

/**
 * Represents which feature plugins can use
 */
enum ApiFeature {
	// VK, DS, Slack
	Attachments,
	// VK, DS
	IncomingMessageWithMultipleAttachments,
	// VK, DS
	OutgoingMessageWithMultipleAttachments,
	// DS
	GuildSupport,
	// VK, DS
	ChatMemberList,
	// TG, MC
	EmbeddedMessageButtons,
	// MC
	TextButtons,
	// VK, TG
	ChatButtons,
	// DS, Slack
	MessageReactions,
	// VK, TG, DS
	EditMessage,
	// VK, TG
	MessageReply,
	// VK, TG
	MessageForward,
	// MC
	TabCompleteEvent,
}

export function apiFeatureRequirement<A extends Api<A>>(feature: ApiFeature): Requirement<MessageEventContext<A>> {
	return ctx => ctx.api.isFeatureSupported(feature);
}

export default ApiFeature;
