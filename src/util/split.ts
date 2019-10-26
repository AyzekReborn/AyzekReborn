export function extractMax(text: string, length: number, separator: string): [string | null, string] {
	let result = null;
	let lines = text.split(separator);
	while (lines.length !== 0 && (result ? (result.length + 1) : 0) + lines[0].length <= length) {
		if (result === null)
			result = lines[0];
		else
			result += separator + lines[0];
		lines.shift();
	}
	return [result, lines.join(separator)];
}
export function extractMaxChars(text: string, length: number): [string, string] {
	return [text.slice(0, length), text.slice(length)];
}
export function extractMaxPossiblePart(text: string, length: number): [string, string] {
	const extractedLine = extractMax(text, length, '\n');
	if (extractedLine[0] !== null) return extractedLine as [string, string];
	const extractedWord = extractMax(text, length, ' ');
	if (extractedWord[0] !== null) return extractedWord as [string, string];
	return extractMaxChars(text, length);
}
export function splitByMaxPossibleParts(text: string, length: number): string[] {
	let result = [];
	while (text.length !== 0) {
		let max = extractMaxPossiblePart(text, length);
		result.push(max[0]);
		text = max[1];
	}
	return result;
}
