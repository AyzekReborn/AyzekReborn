enum ApiFeature {
	// VK
	IncomingMessageWithMultipleAttachments,
	// VK
	OutgoingMessageWithMultipleAttachments,
	// DS
	GuildSupport,
	// VK, DS
	ChatMemberList,
	// TG
	EmbeddedMessageButtons,
	// VK, TG
	ChatButtons,
	// VK, TG, DS
	EditMessage,
	// VK, TG
	MessageReply,
	// VK, TG
	MessageForward,
}
export default ApiFeature;
