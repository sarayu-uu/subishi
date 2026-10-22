import type { Map } from 'maplibre-gl';
import { limitMap, revealTelangana } from './map/telangana';

type Opts = {
  /** null when the splash has already been put away (the app took over before the data or map were ready). */
  map: Map | null; splash: HTMLElement | null; slot: HTMLElement;
  /** Skip the long version (the link already says what to show). */
  quick: boolean;
  /** Move the map to where the intro ends; `duration` 0 means jump. */
  land: (map: Map, duration: number) => void;
  onNav: () => void; onPins: () => void; onUI: () => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FADE = 700, HOLD = 500, FLIGHT = 1800;

/**
 * Logo centre → the splash fades away as the logo lands in the nav, showing Telangana → hold → fly to Hyderabad →
 * pins pop in → filter bar and sheet slide in. Any tap, drag or scroll skips to the end.
 * Shared links and repeat visits skip straight to their view; reduced motion cross-fades to the end view, no flight.
 */
export async function runIntro(o: Opts, startedAt: number) {
  if (!o.splash) {
    // Already past the splash: just bring the app in at its final view.
    o.onNav();
    if (o.map) { revealTelangana(o.map); o.land(o.map, 0); limitMap(o.map); }
    o.onPins(); o.onUI();
    return;
  }
  const splash = o.splash;
  const logo = splash.querySelector<HTMLElement>('.logo')!;
  let skipped = false;
  let short = false;
  try { short = sessionStorage.getItem('intro-seen') === '1'; } catch { /* storage blocked: play the intro */ }
  const skip = () => { skipped = true; };
  addEventListener('pointerdown', skip, { once: true, capture: true });
  addEventListener('wheel', skip, { once: true, capture: true });
  const seen = () => { try { sessionStorage.setItem('intro-seen', '1'); } catch { /* fine */ } };
  const dock = () => { logo.style.transition = 'none'; logo.style.transform = ''; o.slot.appendChild(logo); splash.remove(); };

  const end = () => {
    // Land the logo in the nav and hand over the map.
    dock(); o.onNav();
    if (o.map) { revealTelangana(o.map); o.land(o.map, reduced() || o.quick ? 0 : 300); limitMap(o.map); }
    o.onPins(); o.onUI();
    seen();
  };

  if (reduced() || short || o.quick) {
    // Put the map in its final place behind the splash first, so the fade reveals it directly.
    if (o.map) { revealTelangana(o.map); o.land(o.map, 0); }
    await wait(short ? 300 : 0);
    splash.style.transition = 'opacity .3s'; splash.style.opacity = '0';
    await wait(300);
    return end();
  }

  // Logo holds in the centre (at least 900 ms from page start).
  await wait(Math.max(0, 900 - (performance.now() - startedAt)));
  if (skipped) return end();

  // The splash fades away while the logo moves into the nav; Telangana's outline and tint fade in underneath.
  const a = logo.getBoundingClientRect(), b = o.slot.getBoundingClientRect();
  logo.style.transition = `transform ${FADE}ms cubic-bezier(.65,0,.35,1)`;
  logo.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.height / a.height})`;
  splash.style.backgroundColor = 'transparent';
  splash.style.pointerEvents = 'none';
  if (o.map) revealTelangana(o.map);
  setTimeout(o.onNav, FADE - 100);
  await wait(FADE); // the flight never starts before the splash has gone
  dock();
  if (skipped) return end();

  // Hold on Telangana, then fly to Hyderabad.
  await wait(HOLD);
  if (skipped) return end();
  if (o.map) {
    o.land(o.map, FLIGHT);
    await new Promise<void>((r) => { const t = setTimeout(r, FLIGHT + 300); o.map!.once('moveend', () => { clearTimeout(t); r(); }); });
    limitMap(o.map);
  }
  if (skipped) return end();

  // Pins pop in, then the filter bar and sheet slide in.
  o.onPins();
  await wait(400);
  o.onUI();
  seen();
}

/** Put the splash away now (no intro): the logo goes straight to the nav and the splash fades out. */
export function dockSplash(slot: HTMLElement) {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const logo = splash.querySelector('.logo');
  if (logo) slot.appendChild(logo);
  splash.style.transition = 'opacity .3s'; splash.style.opacity = '0'; splash.style.pointerEvents = 'none';
  setTimeout(() => splash.remove(), 300);
}
