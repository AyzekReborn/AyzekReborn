import { Readable } from "stream";
import { Data, MaybeTemporary } from "./data";

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
