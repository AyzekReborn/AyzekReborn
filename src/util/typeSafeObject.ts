type WithAddedKey<O, N extends string, T> = O & { [key in N]: T };

export function immutableAdd<O, N extends string, T>(object: O, name: N, value: T): WithAddedKey<O, N, T> {
	return { ...object, [name]: value } as WithAddedKey<O, N, T>;
}
