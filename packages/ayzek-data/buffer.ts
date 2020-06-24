import { unlink, writeFile } from '@meteor-it/fs';
import { createReadStream } from '@meteor-it/utils';
import temp from 'temp';
import { Data, MaybeTemporary } from './data';

/**
 * Easiest to handle data
 */
export class BufferData extends Data {
	constructor(public readonly buffer: Buffer) {
		super();
	}
	toStream() {
		return createReadStream(this.buffer);
	}
	async toBuffer() {
		return this.buffer;
	}
	async toFile() {
		const path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, this.buffer);
		return {
			path,
			cleanIfTemporary: () => unlink(path),
		};
	}
	async toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}
