import Logger from "@meteor-it/logger";
import { CollapseQueueProcessor } from "@meteor-it/queue";
import XRest from "@meteor-it/xrest";

export interface IVKApiRequest {
	method: string,
	params: any | null,
};

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

	xrest: XRest = new XRest('https://api.vk.com/', {});

	async collapser(tasks: IVKApiRequest[]): Promise<any[]> {
		let token = this.token;
		const code = `return[${tasks.map(({ method, params }) => `API.${method}(${JSON.stringify(params || {})})`).join(',')}];`;
		this.logger.debug(code);
		let res = (await this.xrest.emit('POST', '/method/execute', {
			data: {
				code
			}, query: {
				v: '5.103',
				access_token: token
			}
		})).jsonBody!;
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
