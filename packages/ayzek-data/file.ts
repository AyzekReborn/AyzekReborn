import { getReadStream, readFile } from '@meteor-it/fs';
import { Data, MaybeTemporary } from './data';

export class FileData extends Data {
	constructor(public readonly path: string) {
		super();
	}
	toBuffer() {
		return readFile(this.path);
	}
	toStream() {
		return getReadStream(this.path);
	}
	toFile() {
		return Promise.resolve({
			path: this.path,
			cleanIfTemporary: () => Promise.resolve(),
		});
	}
	toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}
