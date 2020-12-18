const parser = require('@babel/parser');
const { readFile, readdir, mkdir, writeFile } = require('fs/promises');
const { default: traverse } = require('@babel/traverse');
const { relative } = require('path');
const { walkDirArray } = require('@meteor-it/fs');
const po = require('gettext-parser').po;

async function extractLines(stripPath, file) {
	const pot = [];

	const program = parser.parse((await readFile(file)).toString(), {
		sourceType: 'module', plugins: ['typescript', 'classProperties'],
	});

	traverse(program, {
		enter(path) {
			if (path.isTaggedTemplateExpression()) {
				if (path.node.tag?.name === 't' || path.node.tag?.property?.name === 't') {
					const quasi = path.node.quasi;
					const quasis = quasi.quasis;
					const expressions = quasi.expressions;
					const out = [quasis[0].value.raw];
					let id = 0;
					if (quasi.leadingComments) {
						pot.push(`#. ${quasi.leadingComments[0].value}`);
					}
					for (const part of quasis.slice(1)) {
						const thisId = id++;
						if (expressions[thisId].leadingComments) {
							pot.push(`#. {${thisId + 1}} - ${expressions[thisId].leadingComments[0].value}`);
						}
						out.push(`{${thisId + 1}}`);
						out.push(part.value.raw);
					}
					pot.push(`#: ${relative(stripPath, file)}:${path.node.loc.start.line}`);
					const msgid = out.join('');
					// pot.push(`msgid "${msgid.replace(/"/g, '\\"')}"`);
					if (msgid.includes('\\n')) {
						pot.push('msgid ""');
						pot.push(...msgid.replace(/\\n/g, '\\n\n').split('\n').map(l => `"${l}"`));
					} else {
						pot.push(`msgid "${msgid.replace(/"/g, '\\"')}"`);
					}
					pot.push('msgstr ""');
					pot.push('');
				}
			}
		},
	});

	return pot;
}

(async () => {


	const plugins = (await readdir('./packages')).filter(e => e.startsWith('ayzek-plugin-') || e.startsWith('ayzek-private-plugin-'));
	for (const plugin of plugins) {
		const files = await walkDirArray(`./packages/${plugin}`);
		const pot = [];
		for (const file of files) {
			if (file.endsWith('.ts')) {
				pot.push(...await extractLines(`./packages/${plugin}`, file));
			} else if (file.endsWith('.po')) {
				const parsed = po.parse(await readFile(file));
				const out = {};
				for (const context of Object.getOwnPropertyNames(parsed.translations)) {
					out[context] = {};
					for (const message of Object.getOwnPropertyNames(parsed.translations[context])) {
						if (message === '') {
							continue;
						}
						out[context][message] = parsed.translations[context][message].msgstr[0];
					}
				}
				await writeFile(file.replace(/\.po$/, '.json'), JSON.stringify(out, null, 4));
			}
		}
		if (pot.length !== 0) {
			try {
				await mkdir(`./packages/${plugin}/translations`);
			} catch (e) {
				// ignored
			}
			await writeFile(`./packages/${plugin}/translations/template.pot`, `msgid ""
msgstr ""
"Project-Id-Version: \\n"
"POT-Creation-Date: \\n"
"PO-Revision-Date: \\n"
"Language-Team: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Generator: Ayzek gettext\\n"
"Last-Translator: \\n"
"Language: none\\n"

${pot.join('\n')}`);
		}
	}
})();
