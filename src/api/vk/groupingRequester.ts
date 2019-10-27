import { CollapseQueueProcessor } from "@meteor-it/queue";
import VKApiProcessor, { IVKApiRequest } from "./apiProcessor";

export default class GroupingVKApiRequester<V> extends CollapseQueueProcessor<V, any>{
	constructor(limit: number, public apiProcessor: VKApiProcessor, public requestCreator: (v: V[]) => IVKApiRequest, public rewrapper: (v: any) => any[]) {
		super(600, limit, true);
	}
	async collapser(tasks: V[]): Promise<any[]> {
		return this.rewrapper(await this.apiProcessor.runTask(this.requestCreator(tasks)));
	}
}
