import Logger from "@meteor-it/logger";
import { CollapseQueueProcessor } from "@meteor-it/queue";
import XRest from "@meteor-it/xrest";
import * as https from 'https';

export interface IVKApiRequest {
	method: string,
	params: any | null,
};

const VK_API_VERSION = '5.103';

export default class VKApiProcessor extends CollapseQueueProcessor<IVKApiRequest, any>{
	/**
	 * Executes vk api requests, grouping into method.execute
	 *
	 * @param logger
	 * @param tokens User/group tokens, choosen round-robing on request (TODO: Maybe there is no sense in this anymore)
	 * @param isUserTokens Users have stricter limits
	 */
	constructor(public logger: Logger, public tokens: string[], public isUserTokens: boolean) {
		// Per https://vk.com/dev/api_requests
		super(Math.ceil(isUserTokens ? (1000 / 3) : (1000 / 20)), 25, 0);
	}

	get token() {
		return this.tokens[0];
	}

	xrest: XRest = new XRest('https://api.vk.com/', {
		agent: new https.Agent({
			keepAlive: true,
			keepAliveMsecs: 5000,
			maxSockets: Infinity,
			maxFreeSockets: 256,
		})
	});

	async collapser(tasks: IVKApiRequest[]): Promise<any[]> {
		let token = this.token;

		if (tasks.length === 1) {
			const task = tasks[0];
			this.logger.debug(`{yellow}${task.method}{/yellow}`, JSON.stringify(task.params || {}));
			const res = (await this.xrest.emit('POST', `/method/${task.method}`, {
				data: task.params || {},
				query: {
					v: VK_API_VERSION,
					access_token: token
				}
			})).jsonBody!;
			this.logger.debug(res);
			if (res.error)
				return [new Error(`${res.error.error_msg} (at ${task.method} call)`)];
			return [res.response];
		} else {
			const code = `return[${tasks.map(({ method, params }) => {
				const json = JSON.stringify(params || {});
				this.logger.debug(`{yellow}${method}{/yellow}`, json)
				return `API.${method}(${json})`
			}).join(',')}];`;
			let res;
			if (code.length > 2000) {
				res = (await this.xrest.emit('POST', '/method/execute', {
					data: {
						code
					}, query: {
						v: VK_API_VERSION,
						access_token: token
					}
				})).jsonBody!;
			} else {
				res = (await this.xrest.emit('GET', '/method/execute', {
					query: {
						code,
						v: VK_API_VERSION,
						access_token: token
					}
				})).jsonBody!;
			}
			let responses = res.response;
			const errors = res.execute_errors;
			let errorId = 0;
			return tasks.map((_task, id) => {
				if (responses[id] === false) {
					const error = errors[errorId++];
					return new Error(`${error.error_msg} (at ${error.method} call)`);
				}
				return responses[id];
			});
		}
	}
}
