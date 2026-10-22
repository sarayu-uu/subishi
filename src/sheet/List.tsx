import type { JSX } from 'preact';
import type { Project, Status, Zone } from '../types';
import { count, oneLine, rowPrice } from './format';
import { Briefcase, Dome, Plane, Road, Tree } from './icons';

type Props = {
  projects: Project[]; total: number; statuses: Status[]; zones: Zone[]; searching: boolean; filtered: boolean;
  onSelect: (p: Project, keyboard: boolean) => void; onZone: (z: Zone) => void; onReset: () => void;
};
const ZONE_ICON: Record<string, () => JSX.Element> = { west: Briefcase, north: Tree, south: Plane, central: Dome, kamareddy: Road };

/** Photo with a plain placeholder behind it; a missing or broken image just leaves the placeholder. */
export const Thumb = ({ src }: { src?: string }) => (
  <span class="thumb">{src && <img src={src} alt="" loading="lazy" decoding="async" onError={(e) => ((e.currentTarget as HTMLElement).hidden = true)} />}</span>
);

export function List({ projects, total, statuses, zones, searching, filtered, onSelect, onZone, onReset }: Props) {
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
      </div>
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
                <button key={p.id} class="row" onClick={(e) => onSelect(p, e.detail === 0)}>
                  <Thumb src={p.media.thumb} />
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
