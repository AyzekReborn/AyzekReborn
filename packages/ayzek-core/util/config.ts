import { isLeft } from 'fp-ts/lib/Either';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter';
import YAML from 'yaml';

export function parseYaml<P extends t.Type<any, any, any>>(data: string, type: P): t.TypeOf<P> {
	const config = YAML.parse(data);
	return validateData(config, type);
}

export function validateData<P extends t.Type<any, any, any>>(data: unknown, type: P): t.TypeOf<P> {
	const decoded = type.decode(data);
	if (isLeft(decoded))
		throw new Error(`Validation failed:\n${PathReporter.report(decoded).join('\n')}`);
	return decoded.right;
}
