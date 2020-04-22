export function isNotNullOrUndefined<T>(input: null | undefined | T): input is T {
	return input != null;
}

export function exclude<T>(a: T[], ...others: T[][]): T[] {
	const mergedOthers: T[] = [];
	for (const other of others)
		mergedOthers.push(...other);
	return a.filter(e => !mergedOthers.includes(e));
}
