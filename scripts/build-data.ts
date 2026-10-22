// npm run data — validates every project file and writes public/data/index.json
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { z } from 'zod';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const statuses = read('data/config/statuses.json') as { id: string }[];
const zones = read('data/config/zones.json') as { id: string }[];
const types = read('data/config/types.json') as { id: string }[];
const CATEGORIES = ['transport', 'jobs', 'city', 'landmark', 'school', 'hospital', 'market', 'metro'] as const;
type Landmark = { id: string; name: string; shortName?: string; category: (typeof CATEGORIES)[number]; location: { lat: number; lng: number } | null; verify?: boolean };
const landmarks = read('data/config/landmarks.json') as Landmark[];
// project id → its nearby schools, then hospital (data/config/nearby.json)
const NEAR = read('data/config/nearby.json') as Record<string, string[]>;
const ids = (a: { id: string }[]) => a.map((x) => x.id) as [string, ...string[]];

const Project = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  tagline: z.string().max(60).optional(),
  status: z.enum(ids(statuses)),
  type: z.enum(ids(types)),
  zone: z.enum(ids(zones)),
  location: z.object({ lat: z.number().min(15.8).max(19.95), lng: z.number().min(77.2).max(81.4), locality: z.string(), precision: z.enum(['exact', 'locality', 'area']) }),
  possession: z.string().regex(/^(ready|\d{4}-\d{2})$/).optional(),
  config: z.array(z.string()).default([]),
  sizes: z.object({ builtUpSft: z.array(z.number()).max(2).optional(), plotSqYd: z.array(z.number()).max(2).optional() }).default({}),
  scale: z.object({ units: z.number().optional(), unitLabel: z.string().optional(), acres: z.number().optional(), floors: z.number().optional() }).default({}),
  price: z.object({ from: z.number().nullable(), to: z.number().nullable().optional(), label: z.string().optional(), range: z.string().optional(), note: z.string().optional(),
    source: z.object({ name: z.string(), url: z.url(), asOf: z.string() }).optional() }).passthrough().optional(),
  approvals: z.object({ rera: z.string().optional(), authority: z.enum(['HMDA', 'DTCP', 'GHMC']).optional() }).default({}),
  nearby: z.array(z.enum(ids(landmarks))).max(3).default([]),
  highlights: z.array(z.string().max(40)).max(3).default([]),
  links: z.partialRecord(z.enum(['website', 'websiteAlt', 'video', 'videoIntro', 'brochure', 'maps', 'instagram', 'facebook']), z.url()),
  media: z.object({ thumb: z.string().optional(), hero: z.string().optional() }).default({}),
  published: z.boolean().default(true),
  order: z.number().default(100),
  meta: z.unknown().optional(),
});

for (const l of landmarks) if (!CATEGORIES.includes(l.category)) { console.error(`✗ landmarks.json: "${l.id}" has unknown category "${l.category}"`); process.exit(1); }
// nearby.json must only name projects and landmarks that exist.
const projectIds = new Set(readdirSync('data/projects').filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));
for (const [pid, list] of Object.entries(NEAR)) {
  if (!projectIds.has(pid)) { console.error(`✗ nearby.json: unknown project "${pid}"`); process.exit(1); }
  for (const id of list) if (!landmarks.some((l) => l.id === id)) { console.error(`✗ nearby.json (${pid}): unknown landmark "${id}"`); process.exit(1); }
}

// Approximate drive time: road ≈ 1.25 × straight line; first 10 km at 28 km/h, the rest at 60 km/h.
const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) ** 2));
};
const drive = (d: number) => { const r = d * 1.25; const m = Math.max(5, Math.round(((Math.min(r, 10) / 28 + Math.max(r - 10, 0) / 60) * 60) / 5) * 5);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`; };
const LM = Object.fromEntries(landmarks.filter((l) => l.location).map((l) => [l.id, l])); // only landmarks with a location
const JOBS = ['financial-district', 'hitec-city', 'gachibowli'];
const CITY = { lat: 17.42291, lng: 78.47542 }; // Hyderabad centre (Hussain Sagar)
const FAR_KM = 25; // a "nearby" landmark further than this from its project is probably a data mistake

let errors = 0;
const projects = readdirSync('data/projects').filter((f) => f.endsWith('.json')).map((f) => {
  const raw = read(`data/projects/${f}`);
  const r = Project.safeParse(raw);
  if (!r.success) { errors++; console.error(`✗ ${f}\n${z.prettifyError(r.error)}`); return null; }
  if (r.data.id !== f.replace('.json', '')) { errors++; console.error(`✗ ${f}: id "${r.data.id}" must match the file name`); }
  return r.data;
}).filter((p) => p && p.published) as z.infer<typeof Project>[];
if (errors) { console.error(`\n${errors} problem(s). Nothing written.`); process.exit(1); }

const out = projects.sort((a, b) => a.order - b.order).map(({ meta, ...p }) => {
  const { lat, lng } = p.location;
  const dist = (id: string) => km(lat, lng, LM[id].location!.lat, LM[id].location!.lng);
  const nearest = (ids: string[]) => ids.filter((id) => LM[id]).sort((a, b) => dist(a) - dist(b))[0];
  const near = NEAR[p.id] ?? [];
  for (const id of near) if (LM[id] && dist(id) > FAR_KM) console.warn(`⚠ ${p.id}: "${id}" is ${Math.round(dist(id))} km away — check nearby.json or its location`);
  // Up to three drive times, in the order families ask: nearest school, nearest hospital, nearest job hub, then the
  // airport if a slot is still free. Landmarks without a location are skipped; ones still marked "verify" say "approx.".
  // Outside Hyderabad: just the drive to the city. None when the pin is only an area guess.
  // On the card: the short name, with the area ("Continental Hospitals, Nanakramguda" → "Nanakramguda") on a second line.
  // A school sharing the project's name (Silver Oaks) is labelled as separate, so nobody thinks it is part of the community.
  const label = (l: Landmark) => {
    const area = l.shortName ? l.name.split(', ').slice(1).join(', ') : '';
    const twin = l.category === 'school' && l.name.toLowerCase().startsWith(p.name.toLowerCase());
    return { name: l.shortName ?? l.name, ...(twin ? { area: '(separate school)' } : area ? { area } : {}) };
  };
  let driveTimes: { id: string; name: string; area?: string; category: string; time: string; approx?: true }[] = [];
  if (km(lat, lng, CITY.lat, CITY.lng) > 60) driveTimes = [{ id: 'city', name: 'Hyderabad city centre', category: 'city', time: drive(km(lat, lng, CITY.lat, CITY.lng)) }];
  else if (p.location.precision !== 'area') {
    const picks = [nearest(near.filter((id) => LM[id]?.category === 'school')), nearest(near.filter((id) => LM[id]?.category === 'hospital')), nearest(JOBS), 'rgia'];
    driveTimes = [...new Set(picks.filter(Boolean))].slice(0, 3)
      .map((id) => ({ id, ...label(LM[id]), category: LM[id].category, time: drive(dist(id)), ...(LM[id].verify ? { approx: true as const } : {}) }));
  }
  // Only list images that exist, so the app can show its placeholder instead of a broken image.
  const media: Record<string, string> = Object.fromEntries(Object.entries(p.media).filter(([, src]) => src && existsSync(`public${src}`)));
  // Round photo for the map pin, made by `npm run pins`.
  if (existsSync(`public/img/projects/${p.id}/pin.webp`)) media.pin = `/img/projects/${p.id}/pin.webp`;
  // A highlight that names a place already in the drive times only repeats it ("20 min to Indus International School").
  const shown = driveTimes.flatMap((d) => [LM[d.id]?.name, LM[d.id]?.shortName, d.name]).filter(Boolean).map((n) => n!.toLowerCase());
  const highlights = p.highlights.filter((h) => !shown.some((n) => h.toLowerCase().includes(n)));
  return { ...p, media, driveTimes, highlights };
});

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/index.json', JSON.stringify({
  generated: new Date().toISOString(),
  brand: read('data/config/brand.json'), statuses: read('data/config/statuses.json'), types, zones: read('data/config/zones.json'),
  landmarks: landmarks.filter((l) => l.location), projects: out,
}));
console.log(`✓ ${out.length} projects → public/data/index.json`);
