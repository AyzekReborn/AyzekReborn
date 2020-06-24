import recombine, { RecombineKeyExtractor } from '@ayzek/core/util/recombine';
import { CollapseQueueProcessor } from '@meteor-it/queue';
import type VKApiProcessor from './apiProcessor';
import type { IVKApiRequest } from './apiProcessor';

export default class GroupingVKApiRequester<V> extends CollapseQueueProcessor<V, any>{
	constructor(limit: number, public apiProcessor: VKApiProcessor, public requestCreator: (v: V[]) => IVKApiRequest, public rewrapper: (v: any) => any[], public extractor: RecombineKeyExtractor<any, any>) {
		super(600, limit, true);
	}
	async collapser(tasks: V[]): Promise<any[]> {
		const rewrapped = this.rewrapper(await this.apiProcessor.runTask(this.requestCreator(tasks)));
		return recombine(tasks, rewrapped, this.extractor);
	}
}
