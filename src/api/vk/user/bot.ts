import { Gender } from "../../../model/conversation";
import VKApi from "../api";
import { Image } from '../../../model/attachment/attachment';
import VKUser from "./user";

export default class VKBot extends VKUser {
	constructor(api: VKApi, public apiBot: any) {
		super(
			api,
			(-apiBot.id).toString(),
			api.encodeUserUid(-apiBot.id),
			/^club[0-9]+$/.test(apiBot.screen_name) ? null : apiBot.screen_name,
			apiBot.name,
			null,
			Gender.BOT,
			apiBot.screen_name ? `https://vk.com/${apiBot.screen_name}` : `https://vk.com/club${apiBot.id}`,
			true
		);
	}
	private _photoImage: Promise<Image> | null = null;
	get photoImage() {
		if (this._photoImage)
			return this._photoImage;
		return this._photoImage = Promise.resolve(Image.fromUrl(this.apiBot.photo_200, 'photo.jpeg', 'image/jpeg'));
	}
}
