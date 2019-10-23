module.exports = function (w) {
	return {
		files: [
			'src/**/*.ts',
			{ pattern: 'src/**/*.test.ts', ignore: true }
		],
		tests: [
			'src/**/*.test.ts'
		],
		env: {
			type: 'node'
		},
		testFramework: 'jasmine'
	};
};
