import YAML from 'yaml';
import * as t from 'io-ts';
import { isLeft } from 'fp-ts/lib/Either';
import { PathReporter } from 'io-ts/lib/PathReporter';
import Logger from '@meteor-it/logger';

export function parseConfig<P extends t.Type<any, any, any>>(data: string, logger: Logger, type: P): t.TypeOf<P> {
	const config = YAML.parse(data);

	let decoded = type.decode(config);
	if (isLeft(decoded)) {
		logger.error(`Failed to parse configuration`);
		for (let err of PathReporter.report(decoded)) {
			logger.error(err);
		}
		throw new Error('Configuration parse failed');
	}
	return decoded.right;
}
