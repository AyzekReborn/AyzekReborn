function min(d0: number, d1: number, d2: number, bx: number, ay: number) {
	return d0 < d1 || d2 < d1
		? d0 > d2
			? d2 + 1
			: d0 + 1
		: bx === ay
			? d1
			: d1 + 1;
}

const VECTOR: number[] = [];

export function levenshteinDistance(a: string, b: string, max = 0): number {
	if (a === b)
		return 0;

	// Make a === shorter one
	if (a.length > b.length)
		[a, b] = [b, a];

	let la = a.length;
	let lb = b.length;

	if (la === 0)
		return lb > max ? Infinity : lb;

	// Common suffix
	while (la > 0 && (a.charCodeAt(la - 1) === b.charCodeAt(lb - 1))) {
		la--;
		lb--;
	}

	if (la === 0)
		return lb > max ? Infinity : lb;

	let offset = 0;

	// Common prefix
	while (offset < la && (a.charCodeAt(offset) === b.charCodeAt(offset)))
		offset++;

	la -= offset;
	lb -= offset;

	if (la === 0 || lb < 3) {
		return lb > max ? Infinity : lb;
	}

	const diff = lb - la;

	if (max > lb)
		max = lb;
	else if (diff > max)
		return Infinity;

	let x = 0;
	let d0: number;
	let d1: number;
	let d2: number;
	let d3: number;
	let dd = 0;
	let minDistance = Infinity;

	const vector: number[] = VECTOR;

	for (let y = 0; y < la; y++) {
		vector.push(y + 1);
		vector.push(a.charCodeAt(offset + y));
	}

	const len = vector.length - 1;

	for (; x < lb - 3;) {
		const bx0 = b.charCodeAt(offset + (d0 = x));
		const bx1 = b.charCodeAt(offset + (d1 = x + 1));
		const bx2 = b.charCodeAt(offset + (d2 = x + 2));
		const bx3 = b.charCodeAt(offset + (d3 = x + 3));
		dd = (x += 4);
		minDistance = Infinity;
		for (let y = 0; y < len; y += 2) {
			const dy = vector[y];
			const ay = vector[y + 1];
			d0 = min(dy, d0, d1, bx0, ay);
			d1 = min(d0, d1, d2, bx1, ay);
			d2 = min(d1, d2, d3, bx2, ay);
			dd = min(d2, d3, dd, bx3, ay);
			vector[y] = dd;
			d3 = d2;
			d2 = d1;
			d1 = d0;
			d0 = dy;
			if (max > 0)
				minDistance = Math.min(minDistance, dy);
		}
		if (max > 0 && minDistance > max)
			return Infinity;
	}

	for (; x < lb;) {
		const bx0 = b.charCodeAt(offset + (d0 = x));
		dd = ++x;
		minDistance = Infinity;
		for (let y = 0; y < len; y += 2) {
			const dy = vector[y];
			vector[y] = dd = min(dy, d0, dd, bx0, vector[y + 1]);
			d0 = dy;
			if (max > 0)
				minDistance = Math.min(minDistance, dy);
		}
		if (max > 0 && minDistance > max)
			return Infinity;
	}

	return dd;
}
