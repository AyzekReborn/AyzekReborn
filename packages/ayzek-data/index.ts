import { IRequestOptions } from '@meteor-it/xrest';
import { Readable } from 'stream';
import { BufferData } from "./buffer";
import { Data } from "./data";
import { EmptyData } from './empty';
import { ExternalUrlData } from "./externalUrl";
import { FileData } from "./file";
import { UniqueStreamData } from "./uniqueStream";

export { Data };

export const empty = new EmptyData();
export function fromBuffer(buffer: Buffer): Data {
	return new BufferData(buffer);
}
export function fromStreamUnique(stream: Readable): Data {
	return new UniqueStreamData(stream);
}
export function fromFile(file: string): Data {
	return new FileData(file);
}
export function fromExternalUrl(method: string, url: string, options: IRequestOptions): Data {
	return new ExternalUrlData(method, url, options);
}
