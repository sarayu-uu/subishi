import { Marker as MLMarker, type Map, type Marker } from 'maplibre-gl';
import Supercluster from 'supercluster';
import type { Project, Status } from '../types';

const HOUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.5 10.6l1.2 1.5 1.3-1V20h5.2v-5.2h3.6V20H19v-8.9l1.3 1 1.2-1.5z"/></svg>';
const SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>';
const HYD: [number, number] = [78.4754, 17.4229];
const near = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;
const ORDER = ['ready', 'under-construction', 'upcoming', 'delivered']; // homes you can buy first
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' } as Record<string, string>)[c]};`);
const NAMES_FROM = 11; // name tags under pins from this zoom
const RADIUS = 110; // px; a cluster of three photos and "+N" is ~115 px wide, so anything closer would touch it

/** The round picture inside a pin or a cluster: the project photo, or a drawn stand-in when there is none. */
function face(p: Project) {
  if (p.media.pin) return `<img src="${p.media.pin}" alt="" decoding="async" draggable="false">`;
  if (p.status === 'upcoming') return `<span class="ph soon">${SPARKLE}<small>Soon</small></span>`;
  return `<span class="ph">${HOUSE}</span>`;
}

export function createPins(map: Map, projects: Project[], statuses: Status[], onSelect: (id: string) => void) {
  const color = Object.fromEntries(statuses.map((s) => [s.id, s.color]));
  const label = Object.fromEntries(statuses.map((s) => [s.id, s.label]));
  const byId = new globalThis.Map(projects.map((p) => [p.id, p]));
  let visible = projects;
  let index = new Supercluster<{ id: string; status: string }>({ radius: RADIUS, maxZoom: 15 });
  const markers = new globalThis.Map<string, Marker>();
  let popIn = false;
  let selected: string | null = null;
  let loaded = false; // pins stay hidden until the intro calls popIn()

  const load = () => { loaded = true; index.load(visible.map((p) => ({ type: 'Feature', properties: { id: p.id, status: p.status },
    geometry: { type: 'Point', coordinates: [p.location.lng, p.location.lat] } }))); };

  function el(html: string, cls: string, aria: string, onClick: () => void) {
    const b = document.createElement('button');
    b.className = cls + (popIn ? ' pop' : '');
    b.setAttribute('aria-label', aria);
    b.innerHTML = html;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  /** Selected pin: larger, green ring, name always shown, above its neighbours. */
  function decorate(m: Marker, id: string) {
    const node = m.getElement(), on = id === selected;
    node.classList.toggle('sel', on);
    node.style.zIndex = on ? '5' : '';
  }

  function render() {
    if (!loaded) return;
    map.getContainer().classList.toggle('names', map.getZoom() >= NAMES_FROM);
    // Only what is on screen (plus a small margin), so pin photos load just for pins you can see.
    const b = map.getBounds(), padX = (b.getEast() - b.getWest()) * 0.15, padY = (b.getNorth() - b.getSouth()) * 0.15;
    const zoom = Math.round(map.getZoom());
    const items = index.getClusters([b.getWest() - padX, b.getSouth() - padY, b.getEast() + padX, b.getNorth() + padY], zoom);
    const keep = new Set<string>();
    // Name the cluster "Hyderabad" only while the whole city is one bubble.
    const hydClusters = items.filter((f) => (f.properties as any).cluster && near(f.geometry.coordinates as [number, number], HYD)).length;
    for (const f of items) {
      const c = f.geometry.coordinates as [number, number];
      const props = f.properties as any;
      const key = props.cluster ? `cluster:${props.cluster_id}-${hydClusters}` : props.id;
      keep.add(key);
      if (markers.has(key)) continue;
      let node: HTMLElement;
      if (props.cluster) {
        const n: number = props.point_count;
        const leaves = index.getLeaves(props.cluster_id, Infinity).map((l) => byId.get(l.properties.id)!)
          .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.order - b.order);
        // Up to three faces, photos first, then "+N" for the rest.
        const faces = [...leaves.filter((p) => p.media.pin), ...leaves.filter((p) => !p.media.pin)].slice(0, 3);
        const city = hydClusters === 1 && near(c, HYD) ? `Hyderabad · ${n} homes` : '';
        node = el(`<span class="b">${faces.map((p) => `<span class="f">${face(p)}</span>`).join('')}${n > faces.length ? `<span class="more">+${n - faces.length}</span>` : ''}</span>`
          + (city ? `<span class="cap" aria-hidden="true">${city}</span>` : ''),
          'cl', `${city || `${n} homes`}. Zoom in`, () =>
          map.easeTo({ center: c, zoom: index.getClusterExpansionZoom(props.cluster_id) + 0.5, duration: reduced() ? 0 : 700 }));
      } else {
        const p = byId.get(props.id)!;
        const cls = `pin${p.status === 'delivered' ? ' done' : ''}${p.media.pin ? '' : ' nophoto'}`;
        node = el(`<span class="b">${face(p)}<i class="dot" style="--c:${color[p.status]}"></i><span class="nm" aria-hidden="true">${esc(p.name)}</span></span>`,
          cls, `${p.name}, ${label[p.status]}`, () => onSelect(p.id));
      }
      // The button is centred on its picture, so 'center' puts the picture's middle on the location.
      const m = new MLMarker({ element: node, anchor: 'center' }).setLngLat(c).addTo(map);
      if (!props.cluster) decorate(m, props.id);
      markers.set(key, m);
    }
    for (const [k, m] of markers) if (!keep.has(k)) { m.remove(); markers.delete(k); }
  }

  map.on('moveend', render);
  map.on('zoomend', () => { markers.forEach((m) => m.remove()); markers.clear(); render(); });

  return {
    setFilter(fn: (p: Project) => boolean) { visible = projects.filter(fn); if (!loaded) return; index = new Supercluster({ radius: RADIUS, maxZoom: 15 }); load();
      markers.forEach((m) => m.remove()); markers.clear(); render(); },
    /** Lowest zoom (10–16) at which this project shows as its own pin rather than inside a cluster. */
    zoomFor(id: string) {
      const p = visible.find((x) => x.id === id);
      if (!p || !loaded) return 13;
      const { lng, lat } = p.location, e = 1e-4;
      for (let z = 10; z < 16; z++)
        if (index.getClusters([lng - e, lat - e, lng + e, lat + e], z).some((f) => !(f.properties as any).cluster && (f.properties as any).id === id)) return z;
      return 16;
    },
    /** Highlight one project's pin (or none). */
    select(id: string | null) {
      selected = id;
      for (const [k, m] of markers) if (!k.startsWith('cluster:')) decorate(m, k);
    },
    /** Intro: pins appear 40 ms apart, nearest to Hyderabad first. */
    popIn() {
      popIn = true; load(); render(); popIn = false;
      const list = [...markers.values()].sort((a, b) => {
        const d = (m: Marker) => { const l = m.getLngLat(); return Math.hypot(l.lng - HYD[0], l.lat - HYD[1]); };
        return d(a) - d(b);
      });
      list.forEach((m, i) => setTimeout(() => m.getElement().classList.remove('pop'), 40 * i));
    },
  };
}
