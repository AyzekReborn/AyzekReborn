import { Data, empty as emptyData, fromBuffer, fromExternalUrl, fromFile, fromStreamUnique } from '@ayzek/data';
import { isFile, stat } from '@meteor-it/fs';
import { lookupByPath } from '@meteor-it/mime';
import { emitStreaming, IRequestOptions } from '@meteor-it/xrest';
import { constants } from 'http2';

export type AttachmentType = 'messenger_specific' | 'location' | 'file';

export class Attachment {
	type: AttachmentType;
	constructor(type: AttachmentType) {
		this.type = type;
	}
}

/**
 * Opaque api attachment
 */
export class MessengerSpecificUnknownAttachment extends Attachment {
	constructor(public apiType: string, public apiData: any) {
		super('messenger_specific');
	}
}

/**
 * Geolocation attachment
 */
export class Location extends Attachment {
	constructor(public lat: number, public long: number) {
		super('location');
	}
}

/**
 * Data + name
 */
export class BaseFile extends Attachment {
	constructor(public data: Data, public size: number, public name: string) {
		super('file');
	}
}

interface ParsedData {
	data: Data,
	size: number,
	name: string,
	mime: string,
}

async function parseUrlData(method: string, url: string, options: IRequestOptions, name: string, mime: string | null, defaultMime: string): Promise<ParsedData> {
	const res = await emitStreaming(method, url, options);
	let size = 0;
	const contentLengthHeaderValue = res.headers[constants.HTTP2_HEADER_CONTENT_LENGTH];
	if (typeof contentLengthHeaderValue === 'string')
		size = +contentLengthHeaderValue;
	if (mime === null) {
		const mimeTypeHeaderValue = res.headers[constants.HTTP2_HEADER_CONTENT_TYPE];
		if (typeof mimeTypeHeaderValue === 'string') {
			mime = mimeTypeHeaderValue;
		} else {
			mime = defaultMime;
		}
	}

	return {
		data: fromStreamUnique(res.raw),
		size,
		name,
		mime,
	};
}

async function parseFilePathData(path: string, name: string, mime: string | null, defaultMime: string): Promise<ParsedData> {
	if (!await isFile(path))
		throw new Error(`This is not a file! ${path}`);
	const size = (await stat(path)).size;
	if (mime === null)
		mime = lookupByPath(path) || defaultMime;
	return {
		data: fromFile(path),
		size,
		name,
		mime,
	};
}

/**
 * Plain file, have size and name
 */
export class File extends BaseFile {
	private constructor(data: Data, size: number, name: string, public mime = 'text/plain') {
		super(data, size, name);
	}

	static async fromBuffer(buffer: Buffer, name: string, mime = 'text/plain') {
		return new File(fromBuffer(buffer), buffer.length, name, mime);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, name: string, mime: string | null = null) {
		const parsed = await parseUrlData(method, url, options, name, mime, 'text/plain');
		return new File(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static fromUrlWithSizeKnown(method: string, url: string, options: IRequestOptions, size: number, name: string, mime = 'text/plain') {
		return new File(fromExternalUrl(method, url, options), size, name, mime);
	}
	static async fromFilePath(path: string, name: string, mime: string | null = null) {
		const parsed = await parseFilePathData(path, name, mime, 'text/plain');
		return new File(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
}

/**
 * Images have additional canvas.js integration in them
 */
export class Image extends BaseFile {
	constructor(data: Data, size: number, name: string, public mime: string) {
		super(data, size, name);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, name: string, mime: string) {
		const parsed = await parseUrlData(method, url, options, name, mime, mime);
		return new Image(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static async fromFilePath(path: string, name: string, mime: string) {
		const parsed = await parseFilePathData(path, name, mime, mime);
		return new Image(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static async fromBuffer(buffer: Buffer, name: string, mime: string) {
		return new Image(fromBuffer(buffer), buffer.length, name, mime);
	}
	// FIXME: canvas.js integration
	// static async fromCanvas(canvas: any) {
	// 	let fullStream = canvas.jpegStream({
	// 		bufsize: 4096,
	// 		quality: 100,
	// 		progressive: true
	// 	});
	// 	let buffer = await readStreamToBuffer(fullStream);
	// 	return new Image(createReadStream(buffer), buffer.length);
	// }
}

/**
 * Voice messages have duration
 */
export class Voice extends BaseFile {
	constructor(data: Data, size: number, public name: string, public mime: string, public duration?: number) {
		super(data, size, name);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, title: string, mime: string, duration?: number) {
		const parsed = await parseUrlData(method, url, options, title, mime, mime);
		return new Voice(parsed.data, parsed.size, parsed.name, parsed.mime, duration);
	}
}

/**
 * Audio messages have artist and title
 */
export class Audio extends BaseFile {
	constructor(data: Data, size: number, public artist: string | null, public name: string, public mime: string) {
		super(data, size, artist === null ? name : `${artist} ${name}`);
	}
	static async fromEmpty(artist: string | null, title: string, mime: string) {
		return new Audio(emptyData, 0, artist, title, mime);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, artist: string | null, title: string, mime: string) {
		const parsed = await parseUrlData(method, url, options, title, mime, mime);
		return new Audio(parsed.data, parsed.size, artist, parsed.name, parsed.mime);
	}
	static async fromFilePath(path: string, artist: string | null, title: string, mime: string) {
		const parsed = await parseFilePathData(path, title, mime, mime);
		return new Audio(parsed.data, parsed.size, artist, parsed.name, parsed.mime);
	}
}

/**
 * Videos are opaque for now
 */
export class Video extends BaseFile {
	constructor(data: Data, size: number, public name: string, public mime: string) {
		super(data, size, name);
	}
	static async fromEmpty(title: string, mime: string) {
		return new Video(emptyData, 0, title, mime);
	}
}
