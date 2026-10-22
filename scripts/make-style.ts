// Run once (npx tsx scripts/make-style.ts), commit public/map/style.json, then edit colours there.
import { writeFileSync, mkdirSync } from 'node:fs';
const C = { land: '#F3EEE5', water: '#CFDCE3', park: '#E1E8D6', road: '#FFFFFF', casing: '#E0D6C4', orr: '#3B4C9A', rail: '#CFC6B6', label: '#5E6575', halo: '#F3EEE5' };
const style = await (await fetch('https://tiles.openfreemap.org/styles/positron')).json();
const drop = /boundary|poi|building|housenumber|aeroway_line|highway-shield|road_shield|oneway|tunnel|bridge.*casing$/i;
style.name = 'Subishi';
delete style.sources.ne2_shaded; // unused hillshade images
style.layers = style.layers.filter((l: any) => !drop.test(l.id) && l['source-layer'] !== 'boundary' && l['source-layer'] !== 'poi');
for (const l of style.layers) {
  const p = (l.paint ??= {}), sl = l['source-layer'] ?? '';
  if (l.type === 'background') p['background-color'] = C.land;
  else if (sl === 'water' || sl === 'waterway') { if (l.type === 'fill') p['fill-color'] = C.water; if (l.type === 'line') p['line-color'] = C.water; }
  else if (sl === 'park' || sl === 'landcover' || sl === 'landuse') { if (l.type === 'fill') { p['fill-color'] = C.park; p['fill-opacity'] = 0.7; } }
  else if (sl === 'transportation' && l.type === 'line') {
    const id = l.id as string;
    if (/rail/.test(id)) { p['line-color'] = C.rail; p['line-dasharray'] = [2, 2]; }
    // Expressways turn indigo only once you are near the city; at state zoom they stay quiet.
    else if (/motorway/.test(id) && !/casing/.test(id)) { p['line-color'] = ['interpolate', ['linear'], ['zoom'], 7, C.road, 9, C.orr]; p['line-opacity'] = ['interpolate', ['linear'], ['zoom'], 7, 0.9, 9, 0.55]; }
    else p['line-color'] = /casing/.test(id) ? C.casing : C.road;
  } else if (l.type === 'symbol' && l.paint) {
    p['text-color'] = C.label; p['text-halo-color'] = C.halo; p['text-halo-width'] = 1.4;
    // English names only (OpenStreetMap often stores two scripts in one label).
    if (l.layout?.['text-field']) l.layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];
  }
}
mkdirSync('public/map', { recursive: true });
writeFileSync('public/map/style.json', JSON.stringify(style, null, 1));
console.log(`✓ ${style.layers.length} layers → public/map/style.json`);
