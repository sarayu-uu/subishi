// The three "What are you looking for?" questions and how they filter projects.
import type { Project } from '../types';

export type Choice = { kind: 'all' | 'villa' | 'apartment'; budget: 'all' | 'under1' | '1to3' | 'over3'; when: 'all' | 'now' | 'soon' };
export const ANY: Choice = { kind: 'all', budget: 'all', when: 'all' };

type Option<K extends keyof Choice> = { id: Choice[K]; label: string; hint?: string; short?: string };
export const QUESTIONS: { [K in keyof Choice]: { title: string; note?: string; options: Option<K>[] } } = {
  kind: { title: 'Villa or apartment?', options: [
    { id: 'villa', label: 'Villa', hint: 'A house of your own', short: 'Villas' },
    { id: 'apartment', label: 'Apartment', hint: 'A flat with amenities', short: 'Apartments' },
    { id: 'all', label: 'Either', hint: 'Show both' },
  ] },
  budget: { title: 'Budget', note: 'Homes without a listed price always show.', options: [
    { id: 'under1', label: 'Under ₹1 Cr' }, { id: '1to3', label: '₹1–3 Cr' }, { id: 'over3', label: '₹3 Cr+' }, { id: 'all', label: 'Show all' },
  ] },
  when: { title: 'When do you want to move?', options: [
    { id: 'now', label: 'Now', hint: 'Ready homes', short: 'Move in now' },
    { id: 'soon', label: 'In 1–3 years', hint: 'Being built', short: 'In 1–3 years' },
    { id: 'all', label: 'Just looking', hint: 'See all' },
  ] },
};

const CR = 10_000_000; // one crore, in rupees

export function fits(p: Project, c: Choice) {
  if (c.kind !== 'all' && (c.kind === 'villa') !== (p.type === 'villa')) return false; // "apartment" includes mixed projects
  const from = p.price?.from;
  if (from && c.budget !== 'all') {
    if (c.budget === 'under1' && from >= CR) return false;
    if (c.budget === '1to3' && (from < CR || from >= 3 * CR)) return false;
    if (c.budget === 'over3' && from < 3 * CR) return false;
  }
  if (c.when === 'now' && p.status !== 'ready') return false;
  if (c.when === 'soon' && p.status !== 'under-construction') return false;
  return true;
}

/** "Villas · ₹3 Cr+ · Move in now", or '' when nothing is chosen. */
export const summary = (c: Choice) =>
  (Object.keys(QUESTIONS) as (keyof Choice)[])
    .map((k) => c[k] === 'all' ? '' : (() => { const o = QUESTIONS[k].options.find((x) => x.id === c[k])!; return o.short ?? o.label; })())
    .filter(Boolean).join(' · ');
