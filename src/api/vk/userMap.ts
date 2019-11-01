import PromiseMap from "../promiseMap";
import VKRealUser from "./user/realUser";
import GroupingVKApiRequester from "./groupingRequester";
import VKApi from "./api";

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
		}), (v) => v, u => +u.id);
	}
	protected async getPromise(key: number): Promise<VKRealUser> {
		const apiUser = await this.processor.runTask(key);
		return new VKRealUser(this.api, apiUser);
	}
}
