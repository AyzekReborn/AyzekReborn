import { PromiseMap } from "@meteor-it/utils";
import type VKApi from ".";
import GroupingVKApiRequester from "./groupingRequester";
import VKBot from "./user/bot";

export default class VKBotMap extends PromiseMap<number, VKBot> {
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
		return new VKBot(this.api, apiBot);
	}
}