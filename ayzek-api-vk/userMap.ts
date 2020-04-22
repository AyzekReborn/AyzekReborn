import { PromiseMap } from "@meteor-it/utils";
import type VKApi from ".";
import GroupingVKApiRequester from "./groupingRequester";
import VKRealUser from "./user/realUser";

export default class VKUserMap extends PromiseMap<number, VKRealUser> {
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
		return new VKRealUser(this.api, apiUser);
	}
}
