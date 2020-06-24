import { unlink, writeFile } from '@meteor-it/fs';
import { readStreamToBuffer } from '@meteor-it/utils';
import { Readable } from 'stream';
import temp from 'temp';
import { Data, MaybeTemporary } from './data';

/**
 * Should be used with care
 */
export class UniqueStreamData extends Data {
	got = false;
	constructor(public readonly stream: Readable) {
		super();
	}
	toStream() {
		if (this.got) throw new Error("Can't borrow unique stream twice");
		this.got = true;
		return this.stream;
	}
	private cachedBuffer: Promise<Buffer> | null = null;
	toBuffer() {
		if (this.cachedBuffer) return this.cachedBuffer;
		return this.cachedBuffer = readStreamToBuffer(this.toStream(), Infinity);
	}
	async toFile() {
		const path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, await this.toBuffer());
		return {
			path,
			cleanIfTemporary: () => unlink(path),
		};
	}
	async toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}
