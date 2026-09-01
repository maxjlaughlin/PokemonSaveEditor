// Post-processes the standalone build so the favicon is a data: URI instead of a sibling file -
// keeps dist-standalone/index.html a genuinely single, self-contained file.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const dir = 'dist-standalone';
const htmlPath = `${dir}/index.html`;
const faviconPath = `${dir}/favicon.svg`;

if (!existsSync(faviconPath)) process.exit(0);

const svg = readFileSync(faviconPath, 'utf8');
const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const html = readFileSync(htmlPath, 'utf8').replace('href="./favicon.svg"', `href="${dataUri}"`);
writeFileSync(htmlPath, html);
unlinkSync(faviconPath);
console.log('Inlined favicon into', htmlPath);
