import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Map as MLMap } from 'maplibre-gl'; // type-only: MapLibre stays out of the first bundle
import type { Index, Project, Zone } from './types';
import { runIntro } from './intro';
import { Sheet, sheetPx, type Snap } from './sheet/Sheet';
import { List } from './sheet/List';
import { Card } from './sheet/Card';
import { matches } from './sheet/format';
import { FilterPanel } from './filters/FilterPanel';
import { ANY, fits, summary, type Choice } from './filters/filters';

const START = performance.now();
const projectFromUrl = () => new URLSearchParams(location.search).get('p');
const WIDE = matchMedia('(min-width: 900px)');
const PANEL = 16 + 392; // left panel and its margin, from 900 px
const TOP = 120; // the nav and the "What are you looking for?" bar cover this much of the map
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The part of the map the sheet (phone) or panel (wide) covers when the sheet is at `s`. */
const covered = (s: Snap) => (WIDE.matches ? { left: PANEL, bottom: 0 } : { left: 0, bottom: sheetPx(s) });
const setUrl = (id: string | null) => history.replaceState(history.state, '', id ? `?p=${encodeURIComponent(id)}` : location.pathname);

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
  const [cardFocus, setCardFocus] = useState(false); // card opened from the keyboard
  const [snap, setSnap] = useState<Snap>('peek');
  const [wide, setWide] = useState(WIDE.matches);

  const shownOk = (p: Project) => fits(p, choice) && matches(p, query);
  const shown = useMemo(() => data?.projects.filter(shownOk) ?? [], [data, choice, query]);
  const chosen = summary(choice);
  const selected = data?.projects.find((p) => p.id === selectedId) ?? null;

  /** Centre a project's pin in the part of the map left visible, zoomed in far enough that it is not in a cluster. */
  function focusOn(p: Project, s: Snap) {
    const m = map.current;
    if (!m) return;
    const c = covered(s);
    const zoom = Math.max(m.getZoom(), 12, pinsApi.current?.zoomFor(p.id) ?? 13);
    m.easeTo({ center: [p.location.lng, p.location.lat], zoom, offset: [c.left / 2, (TOP - c.bottom) / 2], duration: reduced() ? 0 : 700 });
  }

  const closeSearch = () => { setSearching(false); setQuery(''); };
  const open = (p: Project, keyboard = false) => {
    if (searching) closeSearch();
    setCardFocus(keyboard);
    setSelectedId(p.id);
    setSnap('half');
    setUrl(p.id);
    focusOn(p, 'half');
  };
  const close = () => { setSelectedId(null); setSnap('peek'); setUrl(null); };
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

  useEffect(() => {
    (async () => {
      const index: Index = await (await fetch('/data/index.json')).json();
      setData(index);

      // The map library loads only after the splash has painted.
      let m = null;
      try {
        const [{ createMap }, { createPins }] = await Promise.all([import('./map/createMap'), import('./map/pins')]);
        m = await Promise.race([createMap(mapRef.current!), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
        if (m) {
          map.current = m;
          pinsApi.current = createPins(m, index.projects, index.statuses, (id) => openRef.current(index.projects.find((p) => p.id === id)!));
          pinsApi.current.setFilter((p) => filterRef.current(p)); // filters may have changed while the map loaded
        }
      } catch { m = null; /* the list view still works without the map */ }

      const deep = projectFromUrl();
      const splash = document.getElementById('splash')!;
      const c = covered('peek');
      await runIntro({
        map: m, splash, slot: slotRef.current!,
        padding: { top: TOP + 10, bottom: c.bottom + 24, left: c.left + 24, right: 24 },
        onNav: () => setNav(true), onPins: () => pinsApi.current?.popIn(), onUI: () => setUI(true),
      }, deep ? START - 10_000 : START);
      const p = deep && index.projects.find((x) => x.id === deep);
      if (p) openRef.current(p);
      else if (deep) setUrl(null);
    })();
    const onWide = () => setWide(WIDE.matches);
    WIDE.addEventListener('change', onWide);
    return () => WIDE.removeEventListener('change', onWide);
  }, []);

  useEffect(() => { pinsApi.current?.setFilter(shownOk); }, [choice, query]);
  useEffect(() => { pinsApi.current?.select(selectedId); }, [selectedId]);
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

  const onSearch = (e: Event) => {
    setQuery((e.currentTarget as HTMLInputElement).value);
    if (selectedId) { setSelectedId(null); setUrl(null); }
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
      {data && (
        <Sheet snap={snap} shown={ui} wide={wide} contentKey={selectedId ?? 'list'}
          onSnap={(s) => (s === 'peek' && selectedId ? close() : setSnap(s))}>
          {selected
            ? <Card key={selected.id} p={selected} status={data.statuses.find((s) => s.id === selected.status)!} zone={data.zones.find((z) => z.id === selected.zone)}
                brand={data.brand} onBack={close} focus={cardFocus} />
            : <List projects={shown} total={data.projects.length} statuses={data.statuses} zones={data.zones} searching={!!query.trim()} filtered={!!chosen}
                onSelect={open} onZone={fitZone} onReset={reset} />}
        </Sheet>
      )}
    </>
  );
}
