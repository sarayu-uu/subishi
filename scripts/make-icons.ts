// npm run icons — PNG app icons from public/favicon.svg (made by scripts/make-icons.py).
// apple-touch-icon is square and full-bleed (iOS rounds the corners itself); the manifest icons keep the rounded square.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/favicon.svg', 'utf8');
const fullBleed = Buffer.from(svg.replace(/rx="\d+"/, 'rx="0"'));
await sharp(fullBleed).resize(180, 180).png().toFile('public/apple-touch-icon.png');
for (const n of [192, 512]) await sharp(Buffer.from(svg)).resize(n, n).png().toFile(`public/icon-${n}.png`);
console.log('✓ apple-touch-icon.png, icon-192.png, icon-512.png');
