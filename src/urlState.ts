// Everything needed to reproduce the current view lives in the URL:
//   /p/<id>?lat=17.14688&lng=78.32948&z=13.2&sheet=half&type=villa&budget=3plus&move=now
// Values that are missing or invalid are simply left out.
import type { Choice } from './filters/filters';
import type { Snap } from './sheet/Sheet';

export type ViewState = {
  project?: string; lat?: number; lng?: number; z?: number; sheet?: Snap;
  type?: Exclude<Choice['kind'], 'all'>; budget?: Exclude<Choice['budget'], 'all'>; move?: Exclude<Choice['when'], 'all'>;
};

// URL words ↔ filter ids
const BUDGET = { u1: 'under1', '1to3': '1to3', '3plus': 'over3' } as const;
const BUDGET_URL = { under1: 'u1', '1to3': '1to3', over3: '3plus' } as const;
const SNAPS: Snap[] = ['peek', 'half', 'full'];
const ID = /^[a-z0-9-]{1,60}$/;

const num = (v: string | null, min: number, max: number) => {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export function read(loc: Pick<Location, 'pathname' | 'search'> = location): ViewState {
  const q = new URLSearchParams(loc.search);
  const s: ViewState = {};
  const fromPath = loc.pathname.match(/^\/p\/([^/]+)\/?$/)?.[1];
  const id = fromPath ? decodeURIComponent(fromPath) : q.get('p'); // ?p=<id> keeps old links working
  if (id && ID.test(id)) s.project = id;
  const lat = num(q.get('lat'), -85, 85), lng = num(q.get('lng'), -180, 180), z = num(q.get('z'), 3, 17);
  if (lat !== undefined && lng !== undefined) { s.lat = lat; s.lng = lng; if (z !== undefined) s.z = z; } // a position needs both halves
  const sheet = q.get('sheet') as Snap;
  if (SNAPS.includes(sheet)) s.sheet = sheet;
  const type = q.get('type');
  if (type === 'villa' || type === 'apartment') s.type = type;
  const budget = q.get('budget');
  if (budget && budget in BUDGET) s.budget = BUDGET[budget as keyof typeof BUDGET];
  const move = q.get('move');
  if (move === 'now' || move === 'soon') s.move = move;
  return s;
}

export const hasState = (s: ViewState) => Object.keys(s).length > 0;

/** Filters from the URL, on top of "no choice". */
export const choiceFrom = (s: ViewState, any: Choice): Choice => ({ kind: s.type ?? any.kind, budget: s.budget ?? any.budget, when: s.move ?? any.when });
export const fromChoice = (c: Choice): Pick<ViewState, 'type' | 'budget' | 'move'> => ({
  type: c.kind === 'all' ? undefined : c.kind, budget: c.budget === 'all' ? undefined : c.budget, move: c.when === 'all' ? undefined : c.when,
});

/** Path + query for a state, e.g. "/p/serenity?lat=…". Peek is the default sheet height, so it is left out. */
export function toPath(s: ViewState) {
  const q = new URLSearchParams();
  if (s.lat !== undefined && s.lng !== undefined) {
    q.set('lat', s.lat.toFixed(5)); q.set('lng', s.lng.toFixed(5));
    if (s.z !== undefined) q.set('z', s.z.toFixed(1));
  }
  if (s.sheet && s.sheet !== 'peek') q.set('sheet', s.sheet);
  if (s.type) q.set('type', s.type);
  if (s.budget) q.set('budget', BUDGET_URL[s.budget]);
  if (s.move) q.set('move', s.move);
  const qs = q.toString();
  return (s.project ? `/p/${encodeURIComponent(s.project)}` : '/') + (qs ? `?${qs}` : '');
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Mirror the view into the address bar, at most every 400 ms. replaceState only, so Back still leaves the site. */
export function write(s: ViewState) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const path = toPath(s);
    if (path !== location.pathname + location.search) history.replaceState(history.state, '', path);
  }, 400);
}

export const siteUrl = () => (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || location.origin;
export const toShareUrl = (s: ViewState) => siteUrl() + toPath(s);
