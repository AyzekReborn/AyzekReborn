export function padList(list: string[], chars: string = '  ') {
	return list.map(e => `${chars}${e}`);
}
