export type Hidden<T> = { value: T };
export function hidden<T>(value: T): Hidden<T> {
	return {
		value,
		toString() {
			return '*** HIDDEN ***'
		}
	} as any;
}
