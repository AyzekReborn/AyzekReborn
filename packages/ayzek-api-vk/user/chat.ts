import { validateData } from '@ayzek/core/util/config';
import { Chat } from '@ayzek/model/conversation';
import { PromiseMap } from '@meteor-it/utils';
import * as t from 'io-ts';
import type VKApi from '..';
import GroupingVKApiRequester from '../groupingRequester';
import type VKUser from '../user/user';

export const VKApiChat = t.interface({
	peer: t.interface({
		id: t.number,
		local_id: t.number,
	}),
	chat_settings: t.interface({
		title: t.string,
		owner_id: t.number,
		admin_ids: t.array(t.number),
	}),
});
export type VKApiChatType = t.TypeOf<typeof VKApiChat>;

export class VKChat extends Chat {
	constructor(api: VKApi, public apiChat: VKApiChatType, members: VKUser[], admins: VKUser[]) {
		super(
			api,
			api.encodeChatCid(apiChat.peer.local_id),
			members,
			apiChat.chat_settings.title,
			admins,
			null,
		);
	}
	get photoImage(): Promise<null> {
		return Promise.resolve(null);
	}
}

export class VKChatMap extends PromiseMap<number, VKChat> {
	processor: GroupingVKApiRequester<number>;

	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(100, api.processor, ids => ({
			method: 'messages.getConversationsById',
			params: {
				peer_ids: ids.map(e => e.toString()).join(','),
			},
		}), v => v.items, (u: any) => u.peer.id);
	}

	protected async getPromise(key: number): Promise<VKChat> {
		let apiChat = null;
		try {
			apiChat = await this.processor.runTask(key + 2e9);
		} catch {
			// We have no access to this chat
		}
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
				},
			};
		const validatedChat = validateData(apiChat, VKApiChat);
		let members = null;
		try {
			members = await this.api.execute('messages.getConversationMembers', {
				peer_id: key + 2e9,
			});
		} catch {
			// We can't see members of this chat
		}
		if (members === null)
			members = { items: [] };
		const [memberUsers, adminUsers] = await Promise.all([
			Promise.all(members.items.map((e: any) => this.api.getApiUser(e.member_id)) as Promise<VKUser>[]),
			Promise.all([validatedChat.chat_settings.owner_id, ...validatedChat.chat_settings.admin_ids].map((e: any) => this.api.getApiUser(e))),
		]);
		return new VKChat(
			this.api,
			validatedChat,
			memberUsers.filter((e: VKUser | null) => e !== null) as VKUser[],
			adminUsers.filter((e: VKUser | null) => e !== null) as VKUser[],
		);
	}
}
