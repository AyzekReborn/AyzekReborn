import { getReadStream, readFile, unlink, writeFile } from '@meteor-it/fs';
import { createReadStream, readStreamToBuffer } from '@meteor-it/utils';
import { emit } from '@meteor-it/xrest';
import cloneable from 'cloneable-readable';
import { Readable } from 'stream';
import { readable as streamReadableNow } from 'stream-now';
import temp from 'temp';

interface MaybeTemporary {
	path: string;
	cleanIfTemporary(): Promise<void>;
}

export abstract class Data {
	abstract toStream(): Readable;
	abstract async toBuffer(): Promise<Buffer>;
	abstract async toFile(): Promise<MaybeTemporary>;
	abstract async toExternalUrl(): Promise<MaybeTemporary>;

	static fromBuffer(buffer: Buffer) {
		return new BufferData(buffer);
	}
	static fromStreamCloneable<T extends Readable>(stream: cloneable.Cloneable<T>) {
		return new CloneableStreamData(cloneable(stream));
	}
	static fromStreamAlreadyCloneable<T extends Readable>(stream: cloneable.Cloneable<T>) {
		return new CloneableStreamData(stream);
	}
	static fromStreamUnique(stream: Readable) {
		return new UniqueStreamData(stream);
	}
	static fromFile(file: string) {
		return new FileData(file);
	}
	static fromExternalUrl(file: string) {
		return new ExternalUrlData(file);
	}
}

/**
 * Data with no data available
 * Should be used with care
 */
export class EmptyData extends Data {
	toStream(): Readable {
		throw new Error('No data');
	}
	toBuffer(): Promise<Buffer> {
		throw new Error('No data');
	}
	toFile(): Promise<MaybeTemporary> {
		throw new Error('No data');
	}
	toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('No data');
	}
}

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
		let path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, this.buffer);
		return {
			path,
			cleanIfTemporary: () => unlink(path)
		}
	}
	async toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}

/**
 * Should be used with care
 */
export class CloneableStreamData<T extends Readable> extends Data {
	constructor(public readonly stream: cloneable.Cloneable<T>) {
		super();
	}
	toStream() {
		return this.stream.clone();
	}
	private cachedBuffer: Promise<Buffer> | null = null;
	toBuffer() {
		if (this.cachedBuffer) return this.cachedBuffer;
		return this.cachedBuffer = readStreamToBuffer(this.toStream());
	}
	async toFile() {
		let path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, await this.toBuffer());
		return {
			path,
			cleanIfTemporary: () => unlink(path)
		}
	}
	async toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}

/**
 * Should be used with care
 */
export class UniqueStreamData extends Data {
	got: boolean = false;
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
		return this.cachedBuffer = readStreamToBuffer(this.toStream());
	}
	async toFile() {
		let path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, await this.toBuffer());
		return {
			path,
			cleanIfTemporary: () => unlink(path)
		}
	}
	async toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}

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
			cleanIfTemporary: () => Promise.resolve()
		});
	}
	toExternalUrl(): Promise<MaybeTemporary> {
		throw new Error('Not implemented');
	}
}

// TODO: Identify by public/private(Available by url only for bot)?
export class ExternalUrlData extends Data {
	constructor(public readonly url: string) {
		super();
	}
	async toBuffer() {
		let got = await emit('GET', this.url, {});
		return got.rawBody!;
	}
	toStream(): Readable {
		return streamReadableNow(this.toBuffer().then(v => createReadStream(v)));
	}
	async toFile() {
		let path = temp.path({ prefix: 'ayzek-' });
		await writeFile(path, await this.toBuffer());
		return {
			path,
			cleanIfTemporary: () => unlink(path)
		}
	}
	toExternalUrl() {
		return Promise.resolve({
			path: this.url,
			cleanIfTemporary: () => Promise.resolve()
		})
	}
}
