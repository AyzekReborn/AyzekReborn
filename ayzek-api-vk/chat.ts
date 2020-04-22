import { Chat } from '@ayzek/model/conversation';
import type VKApi from '.';
import type VKUser from './user/user';

export default class VKChat extends Chat<VKApi>{
	constructor(api: VKApi, public apiChat: any, members: VKUser[], admins: VKUser[]) {
		super(
			api,
			apiChat.peer.id,
			api.encodeChatCid(apiChat.peer.local_id),
			members,
			apiChat.chat_settings.title,
			admins,
			null);
	}
	get photoImage(): Promise<null> {
		return Promise.resolve(null);
	}
}
