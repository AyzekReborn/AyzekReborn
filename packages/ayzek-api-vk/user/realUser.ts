import { Image } from '@ayzek/model/attachment';
import { Gender } from "@ayzek/model/conversation";
import type VKApi from "..";
import VKUser from "./user";
import { validateData } from "@ayzek/core/util/config";
import { PromiseMap } from "@meteor-it/utils";
import * as t from 'io-ts';
import GroupingVKApiRequester from "../groupingRequester";

export class VKRealUser extends VKUser {
	constructor(api: VKApi, public apiUser: VKApiUserType) {
		super(
			api,
			api.encodeUserUid(apiUser.id),
			apiUser.domain || null,
			apiUser.first_name,
			apiUser.last_name,
			[
				null,
				Gender.WOMAN,
				Gender.MAN,
			][apiUser.sex] || Gender.OTHER,
			apiUser.domain ? `https://vk.com/${apiUser.domain}` : `https://vk.com/id${apiUser.id}`,
			false,
		);
	}
	private _photoImage: Promise<Image> | null = null;
	get photoImage() {
		if (this._photoImage)
			return this._photoImage;
		throw new Error('unsupported');
		// return this._photoImage = Promise.resolve(Image.fromUrl('GET', this.apiUser.photo_map, {}, 'photo.jpeg', 'image/jpeg'));
	}
}

export const VKApiUser = t.interface({
	id: t.number,
	domain: t.union([t.string, t.undefined]),
	first_name: t.string,
	last_name: t.string,
	sex: t.number,
	// photo_map: t.string,
});
export type VKApiUserType = t.TypeOf<typeof VKApiUser>;

export class VKUserMap extends PromiseMap<number, VKRealUser> {
	processor: GroupingVKApiRequester<number>;
	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(200, api.processor, ids => ({
			method: 'users.get',
			params: {
				user_ids: ids.join(','),
				fields: 'sex,bdate,photo_max,online,domain'
			}
		}), (v) => v, (u: any) => +u.id);
	}
	protected async getPromise(key: number): Promise<VKRealUser | null> {
		const apiUser = await this.processor.runTask(key);
		if (apiUser === null) return null;
		return new VKRealUser(this.api, validateData(apiUser, VKApiUser));
	}
}
