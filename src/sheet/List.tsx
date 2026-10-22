import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Project, Status, Zone } from '../types';
import { count, oneLine, rowPrice } from './format';
import { Briefcase, Dome, Plane, Road, Tree } from './icons';

type Props = {
  projects: Project[]; total: number; statuses: Status[]; zones: Zone[]; searching: boolean; filtered: boolean;
  /** Photos may load (the sheet is open past peek). */ photos: boolean;
  /** When the data was built, for "Last updated". */ updated: string; onExpand: () => void;
  onSelect: (p: Project) => void; onZone: (z: Zone) => void; onReset: () => void;
};
const ZONE_ICON: Record<string, () => JSX.Element> = { west: Briefcase, north: Tree, south: Plane, central: Dome, kamareddy: Road };

/**
 * Photo on a fixed-size cream placeholder, so nothing moves when it arrives. The <img> is only created once photos
 * are allowed and the row is actually on screen; a missing or broken image just leaves the placeholder.
 */
export function Thumb({ src, allowed }: { src?: string; allowed: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!allowed || seen || !src) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '120px 0px' });
    io.observe(box.current!);
    return () => io.disconnect();
  }, [allowed, seen, src]);
  return (
    <span class="thumb" ref={box}>
      {src && seen && <img src={src} alt="" loading="lazy" decoding="async" onError={(e) => ((e.currentTarget as HTMLElement).hidden = true)} />}
    </span>
  );
}

export function List({ projects, total, statuses, zones, searching, filtered, photos, updated, onExpand, onSelect, onZone, onReset }: Props) {
  const [about, setAbout] = useState(false);
  const groups = [...statuses].sort((a, b) => a.order - b.order)
    .map((s) => ({ s, items: projects.filter((p) => p.status === s.id).sort((a, b) => a.order - b.order) }))
    .filter((g) => g.items.length);
  const all = count(total, 'community', 'communities');
  const sub = searching || filtered ? `${projects.length} of ${all} match` : `${all} across Telangana`;
  return (
    <>
      <div class="hello">
        <p>Homes by Subishi</p>
        <h2>{searching ? 'Search results' : 'Find a home for your family'}</h2>
        <p class="sub">{sub}</p>
        <button class="about-i" type="button" aria-label="About this map" aria-expanded={about} aria-controls="about"
          onClick={() => { if (!about) onExpand(); setAbout(!about); }}><i>i</i></button>
      </div>
      {about && (
        <div class="about" id="about">
          <p>
            A concept map of Subishi's projects, made by Sarayu. This isn't an official Subishi website. Prices are indicative
            listings from public property sites; confirm with Subishi. Project details from subishi.com and Subishi's project sites.
            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>,
            tiles by <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>.
            Last updated {new Date(updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
          </p>
        </div>
      )}
      {!searching && (
        <div class="zones" role="group" aria-label="Areas">
          {[...zones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((z) => {
            const Icon = ZONE_ICON[z.id];
            return <button class="zone" onClick={() => onZone(z)}><span>{Icon && <Icon />}{z.label}</span></button>;
          })}
        </div>
      )}
      {!projects.length && (
        <div class="empty">No homes match that. Try another budget.<br /><button onClick={onReset}>Show all homes</button></div>
      )}
      {groups.map((g) => (
        <section key={g.s.id} aria-label={g.s.label}>
          <h3 class="group-t" style={{ '--c': g.s.color }}><i />{g.s.label}</h3>
          <div class="list">
            {g.items.map((p) => {
              const [price, note] = rowPrice(p);
              return (
                <button key={p.id} class="row" data-id={p.id} onClick={() => onSelect(p)}>
                  <Thumb src={p.media.thumb} allowed={photos} />
                  <span class="mid"><b>{p.name}</b><small>{[p.location.locality, oneLine(p)].filter(Boolean).join(' · ')}</small></span>
                  <span class="rt">{price}<em>{note}</em></span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
