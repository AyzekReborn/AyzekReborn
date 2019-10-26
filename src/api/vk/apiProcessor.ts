import { CollapseQueueProcessor } from "@meteor-it/queue";
import Logger from "@meteor-it/logger";
import XRest from "@meteor-it/xrest";

export interface IVKApiRequest {
	method: string,
	params: any | null,
};

export default class VKApiProcessor extends CollapseQueueProcessor<IVKApiRequest, any>{
	constructor(public logger: Logger, public tokens: string[]) {
		super(600, 20);
	}
	get token() {
		return this.tokens[0];
	}
	xrest: XRest = new XRest('https://api.vk.com/', {});
	async collapser(tasks: IVKApiRequest[]): Promise<any[]> {
		let code = 'return [';
		let tasksCodes: string[] = [];
		tasks.forEach(({ method, params }) => {
			tasksCodes.push(`API.${method}(${JSON.stringify(params || {})})`);
		});
		code += tasksCodes.join(',');
		code += '];';
		let token = this.token;
		let res = await this.xrest.emit('POST', '/method/execute', {
			data: {
				code
			}, query: {
				v: '5.90',
				access_token: token
			}
		});
		let responses = res.body.response;
		if (res.body.error || !responses) {
			if (res.body.error.error_code === 14) {
				// Process captcha
				console.log(res.body.error.captcha_sid, res.body.error.captcha_img);
				this.logger.warn('Waiting 15s for captcha skip...');
				await new Promise(res => setTimeout(() => res(), 15000));
				// return await this.executeMulti(tasks);
				// Add tasks to end
				return tasks.map((task) => {
					return this.runTask(task);
				});
			} else {
				return tasks.map(_task => {
					return new Error(res.body.error.error_msg);
				});
			}
		} else
			return tasks.map((_task, id) => {
				return responses[id];
			});
	}
}
