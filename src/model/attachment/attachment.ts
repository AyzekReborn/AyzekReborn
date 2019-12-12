import { isFile, stat } from "@meteor-it/fs";
import { lookupByPath } from '@meteor-it/mime';
import { emitStreaming, IRequestOptions } from '@meteor-it/xrest';
import { constants } from 'http2';
import { Data, EmptyData } from "./data";

export class Attachment {
	type: string;
	constructor(type: string) {
		this.type = type;
	}
}

export class MessengerSpecificUnknownAttachment extends Attachment {
	constructor(type: string, public apiData: any) {
		super(type)
	}
}

export class Location extends Attachment {
	constructor(public lat: number, public long: number) {
		super('location');
	}
}

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
};

async function parseUrlData(method: string, url: string, options: IRequestOptions, name: string, mime: string | null, defaultMime: string): Promise<ParsedData> {
	let res = await emitStreaming(method, url, options);
	let size = 0;
	let contentLengthHeaderValue = res.headers[constants.HTTP2_HEADER_CONTENT_LENGTH];
	if (typeof contentLengthHeaderValue === 'string')
		size = +contentLengthHeaderValue;
	if (mime === null) {
		let mimeTypeHeaderValue = res.headers[constants.HTTP2_HEADER_CONTENT_TYPE];
		if (typeof mimeTypeHeaderValue === 'string') {
			mime = mimeTypeHeaderValue;
		} else {
			mime = defaultMime;
		}
	}

	return {
		data: Data.fromStreamUnique(res.raw),
		size,
		name,
		mime,
	}
}
async function parseFilePathData(path: string, name: string, mime: string | null, defaultMime: string): Promise<ParsedData> {
	if (!await isFile(path))
		throw new Error(`This is not a file! ${path}`);
	let size = (await stat(path)).size;
	if (mime === null)
		mime = lookupByPath(path) || defaultMime;
	return {
		data: Data.fromFile(path),
		size,
		name,
		mime
	};
}

export class File extends BaseFile {
	private constructor(data: Data, size: number, name: string, public mime = 'text/plain') {
		super(data, size, name);
	}

	static async fromBuffer(buffer: Buffer, name: string, mime: string = 'text/plain') {
		return new File(Data.fromBuffer(buffer), buffer.length, name, mime);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, name: string, mime: string | null = null) {
		let parsed = await parseUrlData(method, url, options, name, mime, 'text/plain');
		return new File(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static fromUrlWithSizeKnown(method: string, url: string, options: IRequestOptions, size: number, name: string, mime: string = 'text/plain') {
		return new File(Data.fromExternalUrl(method, url, options), size, name, mime);
	}
	static async fromFilePath(path: string, name: string, mime: string | null = null) {
		let parsed = await parseFilePathData(path, name, mime, 'text/plain');
		return new File(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
}

// Some services looks at extensions, so extension can be changed runtime in adapter
export class Image extends BaseFile {
	constructor(data: Data, size: number, name: string, public mime: string) {
		super(data, size, name);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, name: string, mime: string) {
		let parsed = await parseUrlData(method, url, options, name, mime, mime);
		return new Image(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static async fromFilePath(path: string, name: string, mime: string) {
		let parsed = await parseFilePathData(path, name, mime, mime);
		return new Image(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
	static async fromBuffer(buffer: Buffer, name: string, mime: string) {
		return new Image(Data.fromBuffer(buffer), buffer.length, name, mime);
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
export class Voice extends BaseFile {
	constructor(data: Data, size: number, public name: string, public mime: string) {
		super(data, size, name);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, title: string, mime: string) {
		let parsed = await parseUrlData(method, url, options, title, mime, mime);
		return new Voice(parsed.data, parsed.size, parsed.name, parsed.mime);
	}
}
export class Audio extends BaseFile {
	constructor(data: Data, size: number, public artist: string | null, public name: string, public mime: string) {
		super(data, size, artist === null ? name : `${artist} ${name}`);
	}
	static async fromEmpty(artist: string | null, title: string, mime: string) {
		return new Audio(new EmptyData(), 0, artist, title, mime);
	}
	static async fromUrl(method: string, url: string, options: IRequestOptions, artist: string | null, title: string, mime: string) {
		let parsed = await parseUrlData(method, url, options, title, mime, mime);
		return new Audio(parsed.data, parsed.size, artist, parsed.name, parsed.mime);
	}
	static async fromFilePath(path: string, artist: string | null, title: string, mime: string) {
		let parsed = await parseFilePathData(path, title, mime, mime);
		return new Audio(parsed.data, parsed.size, artist, parsed.name, parsed.mime);
	}
}
export class Video extends BaseFile {
	constructor(data: Data, size: number, public name: string, public mime: string) {
		super(data, size, name);
	}
	static async fromEmpty(title: string, mime: string) {
		return new Video(new EmptyData(), 0, title, mime);
	}
}
