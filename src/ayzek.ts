import Logger from "@meteor-it/logger";
import { TypedEvent } from "./util/event";
import { JoinGuildEvent, JoinChatEvent } from "./model/events/join";
import { LeaveGuildEvent, LeaveChatEvent } from "./model/events/leave";
import { GuildTitleChangeEvent, ChatTitleChangeEvent } from "./model/events/titleChange";
import { MessageEvent } from './model/events/message';
import { Api } from "./model/api";

export class Ayzek<A extends Api<any>> {
	logger: Logger;

	messageEvent = new TypedEvent<MessageEvent<A>>();

	joinGuildEvent = new TypedEvent<JoinGuildEvent<A>>();
	joinChatEvent = new TypedEvent<JoinChatEvent<A>>();

	leaveGuildEvent = new TypedEvent<LeaveGuildEvent<A>>();
	leaveChatEvent = new TypedEvent<LeaveChatEvent<A>>();

	guildTitleChangeEvent = new TypedEvent<GuildTitleChangeEvent<A>>();
	chatTitleChangeEvent = new TypedEvent<ChatTitleChangeEvent<A>>();

	constructor(logger: string | Logger, apis: A[], logEvents: boolean) {
		this.logger = Logger.from(logger);
		for (let api of apis) {
			this.attachApi(api);
		}
		if (logEvents) {
			this.messageEvent.on(e => {
				const chat = e.chat ? ` {yellow}${e.chat.title}{/yellow}` : ''
				const text = e.text.trim().length > 0 ? ` ${e.text.trim()}` : '';
				const attachments = e.attachments.length > 0 ? ` {yellow}+${e.attachments.length}A{/yellow}` : ''
				const forwarded = e.maybeForwarded ? ` {green}+${e.forwarded.length + (e.replyTo ? 1 : 0)}F{/green}` : '';
				e.api.logger.log(`${e.user.fullName}${chat} {gray}»{/gray}${text}${attachments}${forwarded}`);
			});
			this.chatTitleChangeEvent.on(e => {
				e.api.logger.log(`${e.initiator.fullName} renamed {red}${e.oldTitle || '<unknown>'}{/red} -> {green}${e.newTitle}{/green}`);
			});
		}
	}

	private attachApi(api: A) {
		api.messageEvent.pipe(this.messageEvent);

		api.joinGuildEvent.pipe(this.joinGuildEvent);
		api.joinChatEvent.pipe(this.joinChatEvent);

		api.leaveGuildEvent.pipe(this.leaveGuildEvent);
		api.leaveChatEvent.pipe(this.leaveChatEvent);

		api.guildTitleChangeEvent.pipe(this.guildTitleChangeEvent);
		api.chatTitleChangeEvent.pipe(this.chatTitleChangeEvent);
	}
}
