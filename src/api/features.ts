enum ApiFeature {
	// VK, DS
	IncomingMessageWithMultipleAttachments,
	// VK, DS
	OutgoingMessageWithMultipleAttachments,
	// DS
	GuildSupport,
	// VK, DS
	ChatMemberList,
	// TG
	EmbeddedMessageButtons,
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
}
export default ApiFeature;
