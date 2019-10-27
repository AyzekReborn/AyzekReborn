import { Image } from '../../model/attachment/attachment';
import { Chat } from '../../model/conversation';
import VKApi from './api';
import VKUser from './user/user';

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
