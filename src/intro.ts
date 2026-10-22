import type { Map } from 'maplibre-gl';

type Opts = {
  map: Map | null; splash: HTMLElement; slot: HTMLElement;
  /** Skip the long version (the link already says what to show). */
  quick: boolean;
  /** Move the map to where the intro ends; `duration` 0 means jump. */
  land: (map: Map, duration: number) => void;
  onNav: () => void; onPins: () => void; onUI: () => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// While flying in from the state view the map never needs street-level tiles; capping the zoom stops it fetching them.
const FLIGHT_MAX_ZOOM = 8, MAX_ZOOM = 17;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Logo centre → nav bar, Telangana → the projects, then pins and UI. Any tap, drag or scroll skips to the end. */
export async function runIntro(o: Opts, startedAt: number) {
  const logo = o.splash.querySelector<HTMLElement>('.logo')!;
  let skipped = false;
  const short = sessionStorage.getItem('intro-seen') === '1';
  const skip = () => { skipped = true; };
  addEventListener('pointerdown', skip, { once: true, capture: true });
  addEventListener('wheel', skip, { once: true, capture: true });

  const end = () => {
    // Land the logo in the nav and hand over the map.
    logo.style.transition = 'none'; logo.style.transform = '';
    o.slot.appendChild(logo); o.splash.remove(); o.onNav();
    if (o.map) { o.map.setMaxZoom(MAX_ZOOM); o.land(o.map, reduced() || o.quick ? 0 : 300); }
    o.onPins(); o.onUI();
    sessionStorage.setItem('intro-seen', '1');
  };

  if (reduced() || short || o.quick) { await wait(short ? 300 : 0); o.splash.style.transition = 'opacity .3s'; o.splash.style.opacity = '0'; await wait(300); return end(); }

  // 0–900 ms: logo holds (minimum 900 ms, measured from page start).
  await wait(Math.max(0, 900 - (performance.now() - startedAt)));
  if (skipped) return end();

  // 900–1,600 ms: logo moves and shrinks into the nav slot; splash turns transparent.
  const a = logo.getBoundingClientRect(), b = o.slot.getBoundingClientRect();
  const s = b.height / a.height;
  logo.style.transition = 'transform .7s cubic-bezier(.65,0,.35,1)';
  logo.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${s})`;
  o.splash.style.backgroundColor = 'transparent';
  o.splash.style.pointerEvents = 'none';
  setTimeout(o.onNav, 600);
  await wait(500);
  if (skipped) return end();

  // 1,600–3,600 ms: fly from Telangana to the projects.
  if (o.map) {
    await wait(200);
    o.map.setMaxZoom(FLIGHT_MAX_ZOOM);
    o.land(o.map, 2000);
    await new Promise<void>((r) => { const t = setTimeout(r, 2400); o.map!.once('moveend', () => { clearTimeout(t); r(); }); });
    o.map.setMaxZoom(MAX_ZOOM);
  }
  if (skipped) return end();
  logo.style.transition = 'none'; logo.style.transform = ''; o.slot.appendChild(logo); o.splash.remove();

  // 3,400–4,200 ms: pins pop in, then filters and sheet.
  o.onPins();
  await wait(400);
  o.onUI();
  sessionStorage.setItem('intro-seen', '1');
}
