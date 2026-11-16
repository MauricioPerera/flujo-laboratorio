const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist');
const source = readFileSync(join(dist, 'routing.js'), 'utf8');
const routing = source.match(/const flowRouting = \(\(\) => \{\r?\n([\s\S]*?)return \{routeConnections\};/);
if (!routing) throw new Error('Shared routing source is missing.');

const path = join(dist, 'prototipo-proyecto.html');
const html = readFileSync(path, 'utf8');
const embedded = /(\/\/ BEGIN EMBEDDED ROUTING\r?\n)[\s\S]*?(\/\/ END EMBEDDED ROUTING)/;
if (!embedded.test(html)) throw new Error('Standalone routing markers are missing.');
writeFileSync(path, html.replace(embedded, (_, begin, end) => begin + routing[1] + end));
