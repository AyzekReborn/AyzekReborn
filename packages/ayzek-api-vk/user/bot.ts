import { Image } from '@ayzek/model/attachment';
import { Gender } from "@ayzek/model/conversation";
import type VKApi from "..";
import VKUser from "./user";
import { PromiseMap } from '@meteor-it/utils';
import GroupingVKApiRequester from '../groupingRequester';

export class VKBot extends VKUser {
	constructor(public apiUser: any, api: VKApi) {
		super(
			api,
			api.encodeUserUid(-apiUser.id),
			/^club[0-9]+$/.test(apiUser.screen_name) ? null : apiUser.screen_name,
			apiUser.name,
			null,
			Gender.BOT,
			apiUser.screen_name ? `https://vk.com/${apiUser.screen_name}` : `https://vk.com/club${apiUser.id}`,
			true,
		);
	}
	private _photoImage: Promise<Image> | null = null;
	get photoImage() {
		if (this._photoImage)
			return this._photoImage;
		return this._photoImage = Promise.resolve(Image.fromUrl('GET', this.apiUser.photo_200, {}, 'photo.jpeg', 'image/jpeg'));
	}
}

export class VKBotMap extends PromiseMap<number, VKBot> {
	processor: GroupingVKApiRequester<number>;
	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(500, api.processor, ids => ({
			method: 'groups.getById',
			params: {
				group_ids: ids.join(','),
				fields: 'photo_200'
			}
		}), (v) => v, (u: any) => u.id);
	}
	protected async getPromise(key: number): Promise<VKBot> {
		const apiBot = await this.processor.runTask(key);
		return new VKBot(apiBot, this.api);
	}
}
