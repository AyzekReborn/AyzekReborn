import { SimpleArgumentType } from "./core";
import { ParseEntryPoint } from "../command";
import StringReader, { Type } from "../reader";
import { FailType, RangeError } from "./error";

class NumberArgumentType extends SimpleArgumentType<number> {
	constructor(public readonly int: boolean, public readonly minimum = -Infinity, public readonly maximum = Infinity) {
		super();
	}
	parse<P>(_ctx: ParseEntryPoint<P>, reader: StringReader): number {
		let start = reader.cursor;
		let value = this.int ? reader.readInt() : reader.readFloat();
		if (value < this.minimum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_LOW, this.int ? Type.INT : Type.FLOAT, value, this.minimum, this.maximum);
		} else if (value > this.maximum) {
			reader.cursor = start;
			throw new RangeError(reader, FailType.TOO_HIGH, this.int ? Type.INT : Type.FLOAT, value, this.minimum, this.maximum);
		} else {
			return value;
		}
	}
	get examples(): string[] {
		let fixed = this.int ? 0 : 2;
		return [this.minimum.toFixed(fixed), ((this.minimum + this.maximum) / 2).toFixed(fixed), this.maximum.toFixed(fixed)];
	}
	toString() {
		let name = this.int ? 'int' : 'float';
		if (this.minimum === -Infinity && this.maximum === Infinity) {
			return `${name}()`;
		} else if (this.maximum === Infinity) {
			return `${name}(${this.minimum})`;
		} else {
			return `${name}(${this.minimum}, ${this.maximum})`;
		}
	}
}

export class FloatArgumentType extends NumberArgumentType {
	constructor(minimum: number = -Infinity, maximum: number = Infinity) {
		super(false, minimum, maximum);
	}
}

export class IntArgumentType extends NumberArgumentType {
	constructor(minimum: number = -Infinity, maximum: number = Infinity) {
		super(true, minimum, maximum);
	}
}
