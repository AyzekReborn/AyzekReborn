import PromiseMap from "../promiseMap";
import VKApi from "./api";
import VKChat from "./chat";
import GroupingVKApiRequester from "./groupingRequester";
import VKUser from "./user/user";

export default class VKChatMap extends PromiseMap<number, VKChat> {
	processor: GroupingVKApiRequester<number>;

	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(100, api.processor, ids => ({
			method: 'messages.getConversationsById',
			params: {
				peer_ids: ids.map(e => e.toString()).join(',')
			}
		}), v => v.items, u => u.peer.id);
	}

	protected async getPromise(key: number): Promise<VKChat> {
		let apiChat = null;
		try {
			apiChat = await this.processor.runTask(key + 2e9);
		} catch{ }
		if (apiChat === null)
			apiChat = {
				peer: {
					id: key + 2e9,
					local_id: key,
				},
				chat_settings: {
					owner_id: 1,
					admin_ids: [],
					title: `Unprivileged #${key}`,
				}
			};
		let members = null;
		try {
			members = await this.api.execute('messages.getConversationMembers', {
				peer_id: key + 2e9,
			});
		} catch { }
		if (members === null)
			members = { items: [] };
		const [memberUsers, adminUsers] = await Promise.all([
			Promise.all(members.items.map((e: any) => this.api.getApiUser(e.member_id)) as Promise<VKUser>[]),
			Promise.all([apiChat.chat_settings.owner_id, ...apiChat.chat_settings.admin_ids].map((e: any) => this.api.getApiUser(e)))
		]);
		return new VKChat(
			this.api,
			apiChat,
			memberUsers.filter((e: VKUser | null) => e !== null) as VKUser[],
			adminUsers.filter((e: VKUser | null) => e !== null) as VKUser[]
		);
	}
}
