import { UserDisplayableError, CommandSyntaxError } from "../error";

import StringReader, { Type } from "../reader";

export enum FailType {
	TOO_LOW = 'too low',
	TOO_HIGH = 'too high',
}

export class RangeError<T> extends UserDisplayableError {
	constructor(public ctx: StringReader, public failType: FailType, public type: Type, public value: T, public min: T, public max: T) {
		super(`${failType} ${type}: ${value} (Should be ${min} <= x <= ${max})`);
		this.name = 'RangeError';
	}
}

export class BadSeparatorError extends CommandSyntaxError {
	constructor(public ctx: StringReader, separator: string) {
		super(ctx, `bad input error for separator = "${separator}"`);
		this.name = 'BadSeparatorError';
	}
}
