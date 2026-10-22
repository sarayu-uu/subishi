// Text for rows and cards. Every helper returns '' when the data is missing, so callers can hide the line.
import type { Project, Status } from '../types';

const nf = (n: number) => n.toLocaleString('en-IN');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const TYPE_NAME: Record<Project['type'], string> = { villa: 'Villas', apartment: 'Apartments', mixed: 'Homes + shops' };

export const count = (n: number, one: string, many = `${one}s`) => `${nf(n)} ${n === 1 ? one : many}`;
export const range = (a: number[] | undefined, unit: string) =>
  !a?.length ? '' : (a.length > 1 && a[0] !== a[1] ? `${nf(a[0])}–${nf(a[1])}` : nf(a[0])) + unit;
const bhk = (c: string[]) => (c.length ? `${c.map((x) => x.replace(/\s*BHK$/i, '')).join(' & ')} BHK` : '');

/** "Possession Dec 2028", "Ready now" or ''. */
export function possession(p: Project) {
  if (!p.possession) return '';
  if (p.possession === 'ready') return 'Ready now';
  const [y, m] = p.possession.split('-');
  return `Possession ${MON[+m - 1]} ${y}`;
}

/** "3 & 4 BHK Apartments · 2,280–2,790 sft" */
export const oneLine = (p: Project) =>
  [[bhk(p.config), TYPE_NAME[p.type]].filter(Boolean).join(' '), range(p.sizes.builtUpSft, ' sft')].filter(Boolean).join(' · ');

/** Status badge: adds the possession date while a project is being built. */
export const badge = (p: Project, s: Status) =>
  p.status === 'under-construction' && p.possession && p.possession !== 'ready' ? `${s.label} · ${possession(p)}` : s.label;

/** Right-hand column of a list row: ["₹67.55 L", "onwards"] or [null, "On request"]. */
export function rowPrice(p: Project): [string | null, string] {
  if (p.price?.from && p.price.label) return [p.price.label.replace(/^Starts from\s*/i, ''), 'onwards'];
  if (p.status === 'delivered') return [null, 'Sold out'];
  if (p.status === 'upcoming') return [null, 'Soon'];
  return [null, 'On request'];
}

/** Drive-time destination as it reads in a sentence: "To the airport". */
export const toPlace = (d: { id: string; name: string }) => `To ${d.id === 'rgia' ? 'the airport' : d.name}`;

export const matches = (p: Project, q: string) => !q || `${p.name} ${p.location.locality}`.toLowerCase().includes(q.trim().toLowerCase());
