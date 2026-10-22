// npm run pins — writes public/img/projects/<id>/pin.webp (96 × 96, under 5 KB) for the photo map pins.
// Run it after adding or changing a project photo, then commit the new pin.webp files.
import { existsSync, readdirSync, statSync } from 'node:fs';
import sharp from 'sharp';

const DIR = 'public/img/projects';
const SIZE = 96, MAX_BYTES = 5 * 1024;
// Hero photos show the building in the middle with sky above, so take a square a little below centre.
// Per-project nudges (fractions of the photo) for photos where that misses the house.
const FOCUS: Record<string, { x?: number; y?: number; zoom?: number }> = {
  bliss: { x: 0.6, y: 0.42 },
  iris: { x: 0.47, y: 0.2, zoom: 0.55 },
  gowthami: { x: 0.35, y: 0.38, zoom: 0.7 },
  mist: { x: 0.33, y: 0.45, zoom: 0.75 },
  'silver-oaks': { x: 0.65, y: 0.38 },
  'town-centre': { y: 0.72, zoom: 0.55 },
};

let made = 0;
for (const id of readdirSync(DIR)) {
  const src = [`${DIR}/${id}/hero.webp`, `${DIR}/${id}/thumb.webp`].find(existsSync);
  if (!src) { console.log(`– ${id}: no photo, the map shows a placeholder pin`); continue; }
  const { width = 0, height = 0 } = await sharp(src).metadata();
  const f = { x: 0.5, y: 0.58, zoom: 0.8, ...FOCUS[id] };
  const side = Math.round(Math.min(width, height) * f.zoom);
  const left = Math.min(width - side, Math.max(0, Math.round(width * f.x - side / 2)));
  const top = Math.min(height - side, Math.max(0, Math.round(height * f.y - side / 2)));
  const out = `${DIR}/${id}/pin.webp`;
  // Step the quality down until the file fits the budget.
  for (let q = 80; q >= 30; q -= 5) {
    await sharp(src).extract({ left, top, width: side, height: side }).resize(SIZE, SIZE).webp({ quality: q, effort: 6 }).toFile(out);
    if (statSync(out).size <= MAX_BYTES) break;
  }
  const kb = statSync(out).size / 1024;
  console.log(`${kb <= 5 ? '✓' : '✗'} ${id}: ${kb.toFixed(1)} KB`);
  made++;
}
console.log(`${made} pins → ${DIR}/<id>/pin.webp`);
