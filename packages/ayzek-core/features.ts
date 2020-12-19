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
	// TG, DS
	ProvidesLanguage,
	// DS
	ProvidesLocale,
}

export default ApiFeature;
