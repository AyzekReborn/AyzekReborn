import type { Readable } from 'stream';

export interface MaybeTemporary {
	path: string;
	cleanIfTemporary(): Promise<void>;
}

export abstract class Data {
	abstract toStream(): Readable;
	abstract async toBuffer(): Promise<Buffer>;
	abstract async toFile(): Promise<MaybeTemporary>;
	abstract async toExternalUrl(): Promise<MaybeTemporary>;
}
