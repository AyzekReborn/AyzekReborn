import { unlink, writeFile } from "@meteor-it/fs";
import { createReadStream } from "@meteor-it/utils";
import { emit, IRequestOptions } from "@meteor-it/xrest";
import { Readable } from 'stream';
import { readable as streamReadableNow } from 'stream-now';
import temp from "temp";
import { Data } from "./data";

// TODO: Identify by public/private(Available by url only for bot)?
export class ExternalUrlData extends Data {
	constructor(public method: string, public url: string, public options: IRequestOptions) {
		super();
	}
	async toBuffer() {
		let got = await emit(this.method, this.url, this.options);
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
		};
	}
	toExternalUrl() {
		return Promise.resolve({
			path: this.url,
			cleanIfTemporary: () => Promise.resolve()
		});
	}
}
