import { Api } from "../../model/api";
import VKApiProcessor from "./apiProcessor";
import GroupingVKApiRequester from "./groupingRequester";
import { IMessage } from "../../model/message";
import { emit } from "@meteor-it/xrest";
import { nonenumerable } from 'nonenumerable';
import VKUser from "./user";
import VKChat from "./chat";
import PromiseMap from "../promiseMap";
import VKUserMap from "./userMap";
import VKChatMap from "./chatMap";

export default class VKApi extends Api {
	processor: VKApiProcessor;
	userMap: VKUserMap;
	chatMap: VKChatMap;
	// userProcessor: GroupingVKApiRequester<string>;
	// chatProcessor: GroupingVKApiRequester<string>;
	@nonenumerable
	tokens: string[];
	constructor(public apiId: string, public groupId: number, tokens: string[]) {
		super('vk');
		this.processor = new VKApiProcessor(this.logger, tokens);
		this.userMap = new VKUserMap(this);
		this.chatMap = new VKChatMap(this);
		this.tokens = tokens;
	}
	async init() {
	}
	getApiUser(id: number): Promise<VKUser | null> {
		// TODO: Add bot support
		if (id < 0) {
			return Promise.resolve(null);
		}
		return this.userMap.get(id);
	}
	async getApiChat(id: number): Promise<VKChat> {
		if (id >= 2e9) throw new Error('Already transformed id passed');
		return this.chatMap.get(id);
	}
	execute(method: string, params: any) {
		return this.processor.runTask({
			method, params
		});
	}
	async parseMessage(message: any): Promise<IMessage<VKApi>> {
		let chat = message.peer_id > 2e9 ? await this.getApiChat(message.peer_id - 2e9) : null;
		let user = await this.getApiUser(message.from_id);
		return {
			api: this,
			user: user,
			chat: chat,
			conversation: chat || user,
			// TODO: parse attachments
			attachments: [],
			text: message.text || '',
			forwarded: message.fwd_messages ? await Promise.all(message.fwd_messages.map((m: any) => this.parseMessage(m))) : [],
			messageId: message.id.toString()
		};
	}
	async processNewMessageUpdate(update: any) {
		// const [message_id, flags, from_id, timestamp, subject, text, attachments] = update;
		// let user = await this.getApiUser(from_id) //?.
		const parsed = await this.parseMessage(update);
		console.warn(parsed);

	}
	async processUpdate(update: { type: string, object: any }) {
		switch (update.type) {
			case 'message_new':
				await this.processNewMessageUpdate(update.object);
				break;
		}
	}
	async loop() {
		await this.init();
		while (true) {
			//
			let data = await this.execute('groups.getLongPollServer', {
				group_id: 180370112
			});
			if (!data.server) {
				this.logger.error("Can't get data!")
				this.logger.error(data);
			}
			let { key, server, ts } = data;
			eventLoop: while (true) {
				let events = (await emit('GET', server, {
					query: {
						act: 'a_check',
						key,
						ts,
						wait: 25,
						mode: 66,
					},
					timeout: 0
				})).body;

				if (events.failed) {
					switch (events.failed) {
						case 1:
							ts = events.ts;
							continue eventLoop;
						case 2:
						case 3:
							break eventLoop;
						case 4:
						default:
							this.logger.error(`receive error: ${events}`);
							break eventLoop;
					};
				}
				ts = events.ts;

				events.updates.forEach((update: any) => {
					try {
						this.processUpdate(update);
					} catch (e) {
						this.logger.error(`Update processing error: `, update);
						this.logger.error(e.stack);
					}
				});
			}
			this.logger.warn('Loop end (???), waiting before restart');
			await new Promise(res => setTimeout(res, 5000));
		}
	}
}
