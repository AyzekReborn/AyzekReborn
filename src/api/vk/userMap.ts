import PromiseMap from "../promiseMap";
import VKUser from "./user";
import GroupingVKApiRequester from "./groupingRequester";
import VKApi from "./api";

export default class VKUserMap extends PromiseMap<number, VKUser> {
	processor: GroupingVKApiRequester<number>;
	constructor(public api: VKApi) {
		super();
		this.processor = new GroupingVKApiRequester(200, api.processor, ids => ({
			method: 'users.get',
			params: {
				user_ids: ids.join(','),
				fields: 'sex,bdate,photo_max,online,domain'
			}
		}), (v) => v);
	}
	protected async getPromise(key: number): Promise<VKUser> {
		const apiUser = await this.processor.runTask(key);
		return new VKUser(this.api, apiUser);
	}
}
