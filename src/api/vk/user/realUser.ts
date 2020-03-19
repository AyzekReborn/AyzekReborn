import { Image } from '../../../model/attachment/attachment';
import { Gender } from "../../../model/conversation";
import type VKApi from "../api";
import VKUser from "./user";

export default class VKRealUser extends VKUser {
	constructor(api: VKApi, public apiUser: any) {
		super(
			api,
			apiUser.id.toString(),
			api.encodeUserUid(apiUser.id),
			apiUser.domain || null,
			apiUser.first_name || null,
			apiUser.last_name || null,
			[
				null,
				Gender.WOMAN,
				Gender.MAN,
			][apiUser.sex] || Gender.OTHER,
			apiUser.domain ? `https://vk.com/${apiUser.domain}` : `https://vk.com/id${apiUser.id}`,
			false
		);
	}
	private _photoImage: Promise<Image> | null = null;
	get photoImage() {
		if (this._photoImage)
			return this._photoImage;
		return this._photoImage = Promise.resolve(Image.fromUrl('GET', this.apiUser.photo_map, {}, 'photo.jpeg', 'image/jpeg'));
	}
}
