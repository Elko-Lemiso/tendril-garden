const fs = require('node:fs/promises');
const path = require('node:path');
const { build } = require('esbuild');
async function main() {
  const root = path.join(__dirname, '..');
  await build({ entryPoints: [path.join(__dirname, 'film-encode-entry.mjs')], outfile: path.join(root, 'assets/film-encoder.js'), bundle: true, format: 'iife', globalName: 'TendrilFilmExport', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof' });
  await fs.copyFile(path.join(root, 'node_modules/mediabunny/LICENSE'), path.join(root, 'LICENSES/Mediabunny-MPL-2.0.txt'));
  console.log('Built assets/film-encoder.js; the studio remains a static site.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
