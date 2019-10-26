import PromiseMap from "../promiseMap";
import VKChat from "./chat";
import VKApi from "./api";
import GroupingVKApiRequester from "./groupingRequester";
import VKUser from "./user";

export default class VKChatMap extends PromiseMap<number, VKChat> {
	processor: GroupingVKApiRequester<number>;
	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(100, api.processor, ids => ({
			method: 'messages.getConversationsById',
			params: {
				peer_ids: ids.map(e => e.toString()).join(',')
			}
		}), (v) => v.items);
	}
	protected async getPromise(key: number): Promise<VKChat> {
		const apiChat = await this.processor.runTask(key + 2e9);
		let members = await this.api.execute('messages.getConversationMembers', {
			peer_id: key + 2e9,
		});
		let memberUsers: VKUser[] = (await Promise.all(members.items.map((e: any) => this.api.getApiUser(e.member_id)))).filter(e => e !== null) as VKUser[];
		let adminUsers: VKUser[] = (await Promise.all([apiChat.chat_settings.owner_id, ...apiChat.chat_settings.admin_ids].map((e: any) => this.api.getApiUser(e)))).filter(e => e !== null) as VKUser[];
		return new VKChat(this.api, apiChat, memberUsers, adminUsers);
	}
}
