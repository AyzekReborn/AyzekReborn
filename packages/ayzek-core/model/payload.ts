import AJSON from '@meteor-it/ajson';

export type Payload = {
	type: 'command',
	data: string,
} | {
	type: 'pluginPayload',
	pluginName: string,
	pluginPayload: any,
};

export function parsePayload(payload?: string): Payload | undefined {
	if (!payload) return undefined;
	try {
		// TODO: Validate input, signature (to prevent manually crafted payloads),
		// TODO: maybe load data from DB?
		return AJSON.parse(payload);
	} catch {
		return undefined;
	}
}
export function stringifyPayload(payload: Payload, _signature: string) {
	return AJSON.stringify(payload);
}

export function craftCommandPayload(command: string, signature: string) {
	return stringifyPayload({
		type: 'command',
		data: command,
	}, signature);
}
