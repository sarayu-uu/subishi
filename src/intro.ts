import type { Map, PaddingOptions } from 'maplibre-gl';
import { HYDERABAD_BOUNDS } from './map/telangana';

type Opts = { map: Map | null; splash: HTMLElement; slot: HTMLElement; padding: PaddingOptions;
  onNav: () => void; onPins: () => void; onUI: () => void };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Logo centre → nav bar, Telangana → Hyderabad, then pins and UI. Any tap, drag or scroll skips to the end. */
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
    if (o.map) { o.map.fitBounds(HYDERABAD_BOUNDS, { padding: o.padding, duration: reduced() ? 0 : 300 }); }
    o.onPins(); o.onUI();
    sessionStorage.setItem('intro-seen', '1');
  };

  if (reduced() || short) { await wait(short ? 300 : 0); o.splash.style.transition = 'opacity .3s'; o.splash.style.opacity = '0'; await wait(300); return end(); }

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

  // 1,600–3,600 ms: fly from Telangana into Hyderabad.
  if (o.map) {
    await wait(200);
    o.map.fitBounds(HYDERABAD_BOUNDS, { padding: o.padding, duration: 2000, curve: 1.4, essential: true });
    await new Promise<void>((r) => { const t = setTimeout(r, 2200); o.map!.once('moveend', () => { clearTimeout(t); r(); }); });
  }
  if (skipped) return end();
  logo.style.transition = 'none'; logo.style.transform = ''; o.slot.appendChild(logo); o.splash.remove();

  // 3,400–4,200 ms: pins pop in, then filters and sheet.
  o.onPins();
  await wait(400);
  o.onUI();
  sessionStorage.setItem('intro-seen', '1');
}
