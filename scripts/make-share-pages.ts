// Runs at the end of `npm run build`. Chat apps (WhatsApp, Telegram, iMessage) read the link preview from the HTML,
// not from JavaScript, so every project gets its own copy of index.html with its own title, description and picture:
//   dist/p/<id>/index.html   dist/og/<id>.jpg (1200 × 630, < 200 KB)   dist/og/default.jpg
// dist/404.html is a plain copy too, so an unknown /p/<id> still opens the app (which then starts normally).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import type { Index, Project } from '../src/types';

const SITE = (process.env.VITE_SITE_URL || 'https://subishi.vercel.app').replace(/\/$/, '');
const W = 1200, H = 630, BAR = 150, CREAM = '#F6F0E6', INK = '#2A2620', MUTED = '#746A5F';
const FONT = 'scripts/assets/fraunces-600-soft.ttf'; // made by scripts/make-fonts.py
const MAX_BYTES = 200 * 1024;
// Where to cut the photo band (0 = top, 1 = bottom). Most heroes have the building a little below the middle.
const BAND: Record<string, number> = { iris: 0.1 };

const index: Index = JSON.parse(readFileSync('dist/data/index.json', 'utf8'));
const shell = readFileSync('dist/index.html', 'utf8');
mkdirSync('dist/og', { recursive: true });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' } as Record<string, string>)[c]};`);
const TYPE = { villa: 'Villas', apartment: 'Apartments', mixed: 'Homes + shops' } as const;
const spec = (p: Project) => [p.config.length ? `${p.config.map((c) => c.replace(/\s*BHK$/i, '')).join(' & ')} BHK` : '', TYPE[p.type]].filter(Boolean).join(' ');

/** Brand-font text as a transparent PNG (sharp/Pango with the Fraunces file, so it looks the same on any build machine). */
const text = (s: string, size: number, color: string, width: number) =>
  sharp({ text: { text: `<span foreground="${color}">${esc(s)}</span>`, font: `Fraunces ${size}`, fontfile: FONT, rgba: true, dpi: 72, width, wrap: 'none' } }).png().toBuffer();

/** Photo on top, cream bar at the bottom with the name and "by Subishi". */
async function ogImage(out: string, photo: string | null, title: string, sub: string, at = 0.62) {
  const bar = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAR}"><rect width="100%" height="100%" fill="${CREAM}"/></svg>`);
  const name = await text(title, 64, INK, W - 120), by = await text(sub, 32, MUTED, W - 120);
  let base = sharp({ create: { width: W, height: H, channels: 3, background: CREAM } });
  if (photo) {
    // Fill the width, then keep a band a little below the middle: the building, not the sky.
    const wide = await sharp(photo).resize({ width: W }).toBuffer();
    const { height = 0 } = await sharp(wide).metadata();
    const band = Math.min(height, H - BAR), top = Math.round((height - band) * at);
    base = sharp(wide).extract({ left: 0, top, width: W, height: band }).resize(W, H - BAR, { fit: 'cover' }).extend({ bottom: BAR, background: CREAM });
  }
  const layers = [{ input: bar, left: 0, top: H - BAR }, { input: name, left: 60, top: H - BAR + 26 }, { input: by, left: 62, top: H - BAR + 98 }];
  if (!photo) {
    // No photo: the logo in the middle of the cream page instead.
    const logo = await sharp(readFileSync('public/brand/subishi-logo.svg')).resize({ width: 560 }).png().toBuffer();
    const { height = 0 } = await sharp(logo).metadata();
    layers.push({ input: logo, left: (W - 560) / 2, top: Math.round((H - BAR - height) / 2) });
  }
  for (let q = 82; q >= 50; q -= 8) {
    await base.clone().composite(layers).jpeg({ quality: q, mozjpeg: true }).toFile(out);
    if (statSync(out).size <= MAX_BYTES) break;
  }
}

/** Swap the preview tags in a copy of index.html. */
function page(t: { title: string; description: string; image: string; url: string; hero?: string }) {
  const set = (html: string, attr: 'name' | 'property', key: string, value: string) => {
    const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
    const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
    return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
  };
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${esc(t.title)}</title>`);
  html = set(html, 'name', 'description', t.description);
  html = set(html, 'property', 'og:type', 'website');
  html = set(html, 'property', 'og:site_name', 'Subishi');
  html = set(html, 'property', 'og:title', t.title);
  html = set(html, 'property', 'og:description', t.description);
  html = set(html, 'property', 'og:image', t.image);
  html = set(html, 'property', 'og:image:width', String(W));
  html = set(html, 'property', 'og:image:height', String(H));
  html = set(html, 'property', 'og:url', t.url);
  html = set(html, 'name', 'twitter:card', 'summary_large_image');
  // The card's photo is this page's main image: start fetching it while the app boots.
  if (t.hero) html = html.replace('</head>', `    <link rel="preload" as="image" href="${t.hero}" fetchpriority="high" />
  </head>`);
  return html;
}

await ogImage('dist/og/default.jpg', null, 'Homes by Subishi', 'Villas and apartments across Telangana');
const home = page({ title: 'Homes by Subishi', description: 'Every Subishi villa and apartment community across Telangana on one map. A concept map, not an official Subishi website.', image: `${SITE}/og/default.jpg`, url: `${SITE}/` });
writeFileSync('dist/index.html', home);
writeFileSync('dist/404.html', home);

let n = 0;
for (const p of index.projects) {
  const hero = `public/img/projects/${p.id}/hero.webp`;
  const photo = existsSync(hero) ? hero : null;
  if (photo) await ogImage(`dist/og/${p.id}.jpg`, photo, p.name, 'by Subishi', BAND[p.id]);
  const line = [spec(p), p.location.locality].filter(Boolean).join(' in ');
  mkdirSync(`dist/p/${p.id}`, { recursive: true });
  writeFileSync(`dist/p/${p.id}/index.html`, page({
    title: `${p.name} by Subishi`,
    description: [line, p.tagline].filter(Boolean).join('. ') + '.',
    image: `${SITE}/og/${photo ? p.id : 'default'}.jpg`,
    url: `${SITE}/p/${p.id}`,
    hero: p.media.hero,
  }));
  n++;
}
console.log(`✓ ${n} share pages → dist/p/<id>/index.html, previews → dist/og/ (${SITE})`);
