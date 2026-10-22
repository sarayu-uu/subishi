import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Map as MLMap } from 'maplibre-gl'; // type-only: MapLibre stays out of the first bundle
import type { Index, Project, Zone } from './types';
import { dockSplash, runIntro } from './intro';
import { Sheet, sheetPx, type Snap } from './sheet/Sheet';
import { List } from './sheet/List';
import { Card } from './sheet/Card';
import { matches, oneLine } from './sheet/format';
import { FilterPanel } from './filters/FilterPanel';
import { SheetBoundary } from './sheet/Boundary';
import { ANY, fits, summary, type Choice } from './filters/filters';
import { choiceFrom, fromChoice, hasState, read, toShareUrl, write, type ViewState } from './urlState';
import { share } from './share';
import { HYDERABAD } from './map/telangana';

const START = performance.now();
// The splash appears with the HTML's first paint, before this script runs (much earlier on a slow connection).
const SPLASH_SHOWN = (performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime ?? START);
const SPLASH_MAX = 2500; // ms after the splash appeared: the app always takes over by then
document.getElementById('splash')?.setAttribute('data-app', ''); // the app is running: index.html's fallback stands down
const MAP_TIMEOUT = 20000; // ms: a map that hasn't loaded by then (very slow or blocked tiles) counts as failed
const WIDE = matchMedia('(min-width: 900px)');
const PANEL = 16 + 392; // left panel and its margin, from 900 px
const TOP = 120; // the nav and the "What are you looking for?" bar cover this much of the map
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The part of the map the sheet (phone) or panel (wide) covers when the sheet is at `s`. */
const covered = (s: Snap) => (WIDE.matches ? { left: PANEL, bottom: 0 } : { left: 0, bottom: sheetPx(s) });
type Toast = { text: string; url?: string } | null;
/** Resolves once the main stylesheet applies (the nav is positioned by it), or after `max` ms whatever happens. */
const cssReady = (max: number) => new Promise<void>((done) => {
  const t0 = performance.now();
  const check = () => {
    const nav = document.querySelector('.nav');
    if ((nav && getComputedStyle(nav).position === 'absolute') || performance.now() - t0 > max) done();
    else requestAnimationFrame(check);
  };
  check();
});
// Half the size of the widest marker (a three-photo cluster with "+N") and the caption under a cluster,
// so fitting the project points keeps whole markers 24 px clear of every edge, the bars and the sheet.
const MARK_HALF_W = 60, MARK_HALF_H = 24, CAPTION = 32, EDGE = 24;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Straight-line distance in km. */
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2));
};

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const map = useRef<MLMap | null>(null);
  const pinsApi = useRef<ReturnType<typeof import('./map/pins').createPins> | null>(null);
  const [data, setData] = useState<Index | null>(null);
  const [nav, setNav] = useState(false);
  const [ui, setUI] = useState(false);
  const [choice, setChoice] = useState<Choice>(ANY);
  const [asking, setAsking] = useState(false); // filter panel open
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  const [wide, setWide] = useState(WIDE.matches);
  const [toast, setToast] = useState<Toast>(null);

  const shownOk = (p: Project) => fits(p, choice) && matches(p, query);
  const shown = useMemo(() => data?.projects.filter(shownOk) ?? [], [data, choice, query]);
  const chosen = summary(choice);
  const selected = data?.projects.find((p) => p.id === selectedId) ?? null;

  // Out-of-town project (Kamareddy Castles): a chip under the filter bar points to it whenever it is off screen.
  const far = data?.projects.find((p) => data.zones.find((z) => z.id === p.zone)?.outsideCity);
  const farZone = far && data!.zones.find((z) => z.id === far.zone);
  const [farDir, setFarDir] = useState<string | null>(null); // arrow towards it, or null while it is on screen
  const checkFar = () => {
    const m = map.current;
    if (!m || !far) return setFarDir(null);
    const pt = m.project([far.location.lng, far.location.lat]), c = covered(live.current.snap);
    const { clientWidth: w, clientHeight: h } = m.getContainer();
    const top = TOP, bottom = h - c.bottom, left = c.left;
    if (pt.x >= left && pt.x <= w && pt.y >= top && pt.y <= bottom) return setFarDir(null);
    // Point the arrow the way you would have to pan.
    setFarDir(pt.y < top ? '↑' : pt.y > bottom ? '↓' : pt.x < left ? '←' : '→');
  };
  const checkFarRef = useRef(checkFar);
  checkFarRef.current = checkFar;

  /** The view as a URL state: map position, open project, filters, sheet height. */
  const live = useRef({ selectedId, snap, choice });
  live.current = { selectedId, snap, choice };
  const ready = useRef(false); // the intro has finished: from now on the URL follows the view
  const viewState = (): ViewState => {
    const m = map.current, c = m?.getCenter(), { selectedId: id, snap: s, choice: ch } = live.current;
    return { project: id ?? undefined, ...(m && c ? { lat: c.lat, lng: c.lng, z: Math.round(m.getZoom() * 10) / 10 } : {}), sheet: s, ...fromChoice(ch) };
  };
  const sync = () => { if (ready.current) write(viewState()); };
  const syncRef = useRef(sync);
  syncRef.current = sync;

  /** Centre a project's pin in the part of the map left visible, zoomed in far enough that it is not in a cluster. */
  function focusOn(p: Project, s: Snap) {
    const m = map.current;
    if (!m) return;
    const c = covered(s);
    const zoom = Math.max(m.getZoom(), 12, pinsApi.current?.zoomFor(p.id) ?? 13);
    // flyTo arcs out and back in, which reads better than a straight slide when the project is far away (Kamareddy).
    m.flyTo({ center: [p.location.lng, p.location.lat], zoom, offset: [c.left / 2, (TOP - c.bottom) / 2], maxDuration: 1600, ...(reduced() ? { duration: 0 } : {}) });
  }

  const focusOnRef = useRef(focusOn);
  focusOnRef.current = focusOn;

  const closeSearch = () => { setSearching(false); setQuery(''); };
  // What opened the card (a list row, a pin or the edge chip), so Back / Escape can return focus there.
  const opener = useRef<{ id: string; el: Element | null } | null>(null);
  /** Open a project's card at half height. `fly: false` keeps the map where it is (a shared link already placed it). */
  const open = (p: Project, fly = true) => {
    if (searching) closeSearch();
    opener.current = { id: p.id, el: document.activeElement?.closest('.row, .pin, .edge') ?? null };
    setSelectedId(p.id);
    setSnap('half');
    if (fly) focusOn(p, 'half');
  };
  const close = () => {
    setSelectedId(null); setSnap('peek');
    const o = opener.current;
    opener.current = null;
    if (!o?.el) return;
    // The list re-renders and pins may be redrawn, so find the same row or pin again by project id.
    requestAnimationFrame(() => {
      const el = (o.el!.isConnected ? o.el : document.querySelector(`.row[data-id="${o.id}"], .pin[data-id="${o.id}"]`)) as HTMLElement | null;
      el?.focus({ preventScroll: true });
    });
  };
  const openRef = useRef(open);
  openRef.current = open;
  const filterRef = useRef(shownOk);
  filterRef.current = shownOk;

  /** Area chip: fit the map to that area's projects; an out-of-town area with one project opens its card. */
  function fitZone(z: Zone) {
    const all = data!.projects.filter((p) => p.zone === z.id);
    if (z.outsideCity && all.length === 1) return open(all[0]);
    setSnap('peek');
    const m = map.current;
    if (!m) return;
    const c = covered('peek'), duration = reduced() ? 0 : 700;
    const ps = all.some(shownOk) ? all.filter(shownOk) : all;
    if (!ps.length) {
      if (z.view) m.easeTo({ center: z.view.center, zoom: z.view.zoom, offset: [c.left / 2, (TOP - c.bottom) / 2], duration });
      return;
    }
    const lng = ps.map((p) => p.location.lng), lat = ps.map((p) => p.location.lat);
    m.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]],
      { padding: { top: TOP + 30, bottom: c.bottom + 40, left: c.left + 40, right: 40 }, maxZoom: 14, duration });
  }

  const reset = () => { setChoice(ANY); closeSearch(); };

  // ---- start-up -------------------------------------------------------------------------------------------------
  // The data and the map load side by side. The splash never stays longer than SPLASH_MAX after page start: whatever
  // isn't ready by then arrives into the running app (the map attaches itself, the list fills in).
  const introDone = useRef(false);
  const landRef = useRef<((m: MLMap, duration: number) => void) | null>(null);
  const linkedRef = useRef<{ p?: Project; at: boolean }>({ at: false });
  const mapLoad = useRef<Promise<MLMap> | null>(null);
  const [loadError, setLoadError] = useState(false); // index.json failed: offer a retry
  const [mapFailed, setMapFailed] = useState(false); // tiles or the map library failed: list only

  /** Load the map library and create the map, once. A failure (or MAP_TIMEOUT) means "list only". */
  const startMap = () => (mapLoad.current ??= (async () => {
    const { createMap } = await import('./map/createMap');
    return Promise.race([createMap(mapRef.current!), new Promise<never>((_, no) => setTimeout(() => no(new Error('map timed out')), MAP_TIMEOUT))]);
  })());

  /** The map is ready (maybe after the app has already taken over): add pins and put it in place. */
  async function attachMap(m: MLMap, index: Index) {
    const { createPins } = await import('./map/pins');
    map.current = m;
    pinsApi.current = createPins(m, index.projects, index.statuses, (id) => openRef.current(index.projects.find((p) => p.id === id)!));
    pinsApi.current.setFilter((p) => filterRef.current(p)); // filters may have changed while the map loaded
    m.on('moveend', () => { syncRef.current(); checkFarRef.current(); });
    if (!introDone.current) return; // the intro will land it and pop the pins in
    const { limitMap, revealTelangana } = await import('./map/telangana');
    revealTelangana(m);
    // Pins first: placing an open card's pin needs them loaded (to zoom in past its cluster).
    pinsApi.current.popIn();
    pinsApi.current.select(live.current.selectedId);
    landRef.current?.(m, 0);
    const l = linkedRef.current;
    if (l.p && !l.at && live.current.selectedId === l.p.id) focusOnRef.current(l.p, 'half');
    limitMap(m);
  }

  const mapFailedNow = () => {
    setMapFailed(true);
    // Nothing to look at on the map: open the full list at half height (a card from a shared link stays open).
    if (!live.current.selectedId) { setChoice(ANY); setSnap('half'); }
  };

  async function boot() {
    setLoadError(false);
    const dataP = fetch('/data/index.json').then((r) => { if (!r.ok) throw new Error(`index.json ${r.status}`); return r.json() as Promise<Index>; });
    // On a link to one home the card's photo comes first; the map library (about 1 MB) starts once it has shown.
    const forHome = !!read().project;
    if (!forHome) startMap().catch(() => {}); // handled below; avoids an unhandled rejection while we wait for the data
    const deadline = new Promise<'late'>((r) => setTimeout(() => r('late'), Math.max(0, SPLASH_SHOWN + SPLASH_MAX - performance.now())));

    const first = await Promise.race([dataP.then((v) => v, () => 'error' as const), deadline]);
    const late = first === 'late';
    if (late) { dockSplash(slotRef.current!); setNav(true); setUI(true); } // take over; the sheet says "Loading homes…"
    let index: Index;
    try { index = first !== 'late' && first !== 'error' ? first : await dataP; }
    catch { dockSplash(slotRef.current!); setNav(true); setLoadError(true); return; }
    setData(index);

    // A link can carry the whole view. index.json only lists published projects, so an unknown or unpublished
    // project is dropped; the position and filters still apply, and the sheet stays at peek.
    const url = read();
    const linked = url.project ? index.projects.find((p) => p.id === url.project) : undefined;
    const state: ViewState = { ...url };
    if (!linked) { delete state.project; delete state.sheet; }
    const restoring = hasState(state);
    if (restoring) setChoice(choiceFrom(state, ANY));
    const at = state.lat !== undefined && state.lng !== undefined ? { center: [state.lng, state.lat] as [number, number], zoom: state.z } : null;
    linkedRef.current = { p: linked, at: !!at };
    const c = covered('peek');
    landRef.current = (mm, duration) => {
      if (at) mm.jumpTo({ center: at.center, zoom: at.zoom ?? mm.getZoom() });
      else if (!linked) {
        // Every project within 60 km of Hyderabad (so not Kamareddy Castles; the edge chip points to it).
        const city = index.projects.filter((p) => km(p.location, HYDERABAD) <= 60);
        const lng = city.map((p) => p.location.lng), lat = city.map((p) => p.location.lat);
        mm.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], {
          padding: { top: TOP + EDGE + MARK_HALF_H, bottom: c.bottom + EDGE + MARK_HALF_H + CAPTION, left: c.left + EDGE + MARK_HALF_W, right: EDGE + MARK_HALF_W },
          duration, easing: easeInOut, essential: true,
        });
      }
      // a project link without a position: open() below centres its pin
    };

    // Use the map if it is ready within the splash time; otherwise start without it and let it attach later.
    // A link to one home doesn't wait for the map at all: its card is what the visitor came for.
    const remaining = () => Math.max(0, SPLASH_SHOWN + SPLASH_MAX - performance.now());
    const m = late || linked || forHome ? null : await Promise.race([startMap().then((v) => v, () => null), new Promise<null>((r) => setTimeout(() => r(null), remaining()))]);
    if (m) await attachMap(m, index);
    else if (!forHome) startMap().then((mm) => attachMap(mm, index), mapFailedNow);

    await cssReady(remaining()); // the stylesheet loads without blocking the splash
    // The page may already have turned the splash into a loading screen (slow connection): no intro then.
    if (document.getElementById('splash')?.classList.contains('wait')) dockSplash(slotRef.current!);
    await runIntro({
      map: m, splash: document.querySelector<HTMLElement>('#splash:not(.wait)'), slot: slotRef.current!, quick: restoring || !m,
      land: (mm, duration) => landRef.current!(mm, duration),
      onNav: () => setNav(true), onPins: () => pinsApi.current?.popIn(), onUI: () => setUI(true),
    }, START);
    introDone.current = true;
    if (linked) openRef.current(linked, !at);
    if (forHome) {
      // Start the map once the card's photo has loaded (or after 1.5 s), so the home appears first.
      await new Promise<void>((done) => {
        const t = setTimeout(done, 1500);
        requestAnimationFrame(() => {
          const img = document.querySelector<HTMLImageElement>('.hero img');
          if (!img || img.complete) { clearTimeout(t); done(); } else img.addEventListener('load', () => { clearTimeout(t); done(); }, { once: true });
        });
      });
      startMap().then((mm) => attachMap(mm, index), mapFailedNow);
    }
    if (state.sheet) setSnap(linked && state.sheet === 'peek' ? 'half' : state.sheet); // a card is never left at peek
    ready.current = true;
    syncRef.current();
  }

  useEffect(() => {
    boot();
    const onWide = () => setWide(WIDE.matches);
    WIDE.addEventListener('change', onWide);
    return () => WIDE.removeEventListener('change', onWide);
  }, []);

  useEffect(() => { pinsApi.current?.setFilter(shownOk); }, [choice, query]);
  useEffect(() => { pinsApi.current?.select(selectedId); }, [selectedId]);
  useEffect(() => { sync(); checkFar(); }, [selectedId, snap, choice]);
  useEffect(() => { if (searching) searchRef.current?.focus(); }, [searching]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || asking) return; // the filter panel handles its own Escape
      if (searching) closeSearch();
      else if (selectedId) close();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [searching, selectedId, asking]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.url ? 10000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Share exactly what is on screen. */
  async function onShare() {
    const p = selected, url = toShareUrl(viewState());
    const r = await share(url, p ? `${p.name} by Subishi` : 'Homes by Subishi',
      p ? `Have a look at ${p.name} by Subishi: ${oneLine(p)}, ${p.location.locality}` : 'Homes by Subishi across Telangana');
    if (r === 'copied') setToast({ text: 'Link copied. Paste it in your family group.' });
    else if (r === 'manual') setToast({ text: 'Copy this link to share it:', url });
  }

  const onSearch = (e: Event) => {
    setQuery((e.currentTarget as HTMLInputElement).value);
    if (selectedId) setSelectedId(null);
    setSnap('half');
  };

  return (
    <>
      <div id="map" ref={mapRef} />
      <header class={`nav${nav ? ' on' : ''}${searching ? ' searching' : ''}`}>
        <div class="slot" ref={slotRef} />
        {searching && (
          <input ref={searchRef} class="search" type="search" placeholder="Search a home or area" aria-label="Search a home or area"
            autocomplete="off" enterKeyHint="search" value={query} onInput={onSearch} />
        )}
        {!searching && (
          <button class="ibtn share" aria-label="Share this view" onClick={onShare}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5L12 3.5l4 4" /><path d="M7 10.5H6a1.5 1.5 0 00-1.5 1.5v7A1.5 1.5 0 006 20.5h12a1.5 1.5 0 001.5-1.5v-7a1.5 1.5 0 00-1.5-1.5h-1" /></svg>
          </button>
        )}
        <button class="ibtn" aria-label={searching ? 'Close search' : 'Search homes'} onClick={() => (searching ? closeSearch() : setSearching(true))}>
          {searching
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>}
        </button>
      </header>
      {data && (
        <div class={`ask${ui ? ' on' : ''}`}>
          <button class={`ask-b${chosen ? ' set' : ''}`} aria-haspopup="dialog" aria-label={chosen ? `Looking for: ${chosen}. Change` : undefined} onClick={() => setAsking(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
            <span>{chosen || 'What are you looking for?'}</span>
          </button>
          {chosen && (
            <button class="ask-x" aria-label="Clear choices" onClick={() => setChoice(ANY)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
      )}
      {data && asking && (
        <FilterPanel initial={choice} projects={data.projects} onClose={() => setAsking(false)}
          onApply={(c) => { setChoice(c); setAsking(false); if (selectedId) close(); }} />
      )}
      {mapFailed && <div class="map-fail" role="status">The map couldn't load. Here are all the homes.</div>}
      {loadError && (
        <div class="load-fail" role="alert">
          <p>Couldn't load the homes.</p>
          <button type="button" onClick={() => boot()}>Try again</button>
        </div>
      )}
      {(data || (ui && !loadError)) && (
        <Sheet snap={snap} shown={ui} wide={wide} contentKey={selectedId ?? 'list'}
          onSnap={(s) => (s === 'peek' && selectedId ? close() : setSnap(s))}>
          {!data ? <p class="loading" role="status">Loading homes…</p> : (
            // A fresh boundary per card, so an error in one card doesn't stick to the next.
            <SheetBoundary key={selectedId ?? 'list'} onReset={() => (selectedId ? close() : reset())}>
              {selected
                ? <Card key={selected.id} p={selected} status={data.statuses.find((s) => s.id === selected.status)!} zone={data.zones.find((z) => z.id === selected.zone)}
                    brand={data.brand} onBack={close} onShare={onShare} />
                : <List projects={shown} total={data.projects.length} statuses={data.statuses} zones={data.zones} searching={!!query.trim()} filtered={!!chosen}
                    photos={wide || snap !== 'peek'} updated={data.generated} onExpand={() => { if (snap === 'peek') setSnap('half'); }} onSelect={open} onZone={fitZone} onReset={reset} />}
            </SheetBoundary>
          )}
        </Sheet>
      )}
      {far && farDir && ui && !searching && shownOk(far) && (
        <button class="edge" onClick={() => open(far)} aria-label={`${far.name}, ${farZone?.distanceNote ?? 'outside Hyderabad'}. Show it on the map`}>
          {far.media.pin ? <img src={far.media.pin} alt="" /> : <i />}
          <span>{far.name} · {farZone?.distanceNote?.match(/\d+\s*km\s+\w+/)?.[0] ?? 'outside Hyderabad'} {farDir}</span>
        </button>
      )}
      <div class={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
        {toast && <>{toast.text}{toast.url && <span class="toast-url">{toast.url}</span>}</>}
      </div>
    </>
  );
}
