export function padList(list: string[], chars = '  ') {
	return list.map(e => `${chars}${e}`);
}
