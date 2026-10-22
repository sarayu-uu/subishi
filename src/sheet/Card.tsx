import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Brand, Project, Status, Zone } from '../types';
import { badge, count, oneLine, possession, toPlace } from './format';
import { Back, Car, Doc, External, Phone, Pin, Play, Shield, Sparkle } from './icons';

type Props = { p: Project; status: Status; zone?: Zone; brand: Brand; onBack: () => void; /** opened from the keyboard: move focus into the card */ focus?: boolean };
type Fact = { k: string; v: string; sub?: string };
type Btn = { href: string; label: string; icon: JSX.Element; pri?: boolean; ext?: boolean };
const ext = { target: '_blank', rel: 'noopener' };

export function Card({ p, status, zone, brand, onBack, focus }: Props) {
  const done = p.status === 'delivered', soon = p.status === 'upcoming';
  const [heroOk, setHeroOk] = useState(true);
  const [shown, setShown] = useState(false); // photo fades in once it has loaded
  const back = useRef<HTMLButtonElement>(null), img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (focus) back.current?.focus({ preventScroll: true });
    if (img.current?.complete && img.current.naturalWidth) setShown(true); // already cached
  }, []);

  const spec = soon ? p.tagline : oneLine(p) || p.tagline;
  const where = [p.location.locality, zone?.outsideCity ? zone.distanceNote : ''].filter(Boolean).join(' · ');

  const facts: Fact[] = [];
  if (p.scale.units) facts.push({ k: 'Community', v: p.scale.unitLabel ? count(p.scale.units, p.scale.unitLabel, p.scale.unitLabel) : count(p.scale.units, 'home'), sub: p.scale.acres ? `${p.scale.acres} acres` : undefined });
  if (p.sizes.plotSqYd?.length) facts.push({ k: 'Plot', v: `${p.sizes.plotSqYd.join(' & ')} sq yd` });
  else if (p.scale.floors) facts.push({ k: 'Height', v: count(p.scale.floors, 'floor') });
  if (p.status === 'ready' && possession(p)) facts.push({ k: 'Possession', v: possession(p) });

  const L = p.links, phone = brand.contact?.phone, phoneText = brand.contact?.phoneDisplay;
  const video = L.video ? (soon ? 'Watch the reveal' : p.status === 'under-construction' ? 'Watch progress' : 'Watch video') : '';
  const btns: Btn[] = [];
  if (L.video) btns.push({ href: L.video, label: video, icon: <Play />, pri: true, ext: true });
  if (L.website) btns.push({ href: L.website, label: 'Visit site', icon: <External />, pri: !L.video, ext: true });
  if (L.brochure) btns.push({ href: L.brochure, label: 'Brochure', icon: <Doc />, ext: true });
  if (!soon) btns.push({ href: `https://www.google.com/maps/dir/?api=1&destination=${p.location.lat},${p.location.lng}`, label: 'Directions', icon: <Pin />, ext: true });
  if (!done && phone) btns.push({ href: `tel:${phone}`, label: 'Call', icon: <Phone /> });
  const trust = [p.approvals.rera && `RERA ${p.approvals.rera}`, p.approvals.authority && `${p.approvals.authority} approved`].filter(Boolean).join(' · ');

  return (
    <article class="card" aria-labelledby="card-title">
      <button ref={back} class="back" type="button" onClick={onBack}><Back />All homes</button>
      <div class="hero">
        {p.media.hero && heroOk
          ? <img ref={img} class={shown ? 'in' : ''} src={p.media.hero} alt={p.name} loading="lazy" decoding="async"
              onLoad={() => setShown(true)} onError={() => setHeroOk(false)} />
          : <div class="soonart"><div><Sparkle /><b>{p.name}</b><span>{soon ? 'Coming soon' : status.label}</span></div></div>}
        <span class="badge" style={{ '--c': status.color }}><i />{badge(p, status)}</span>
      </div>
      <h2 class="title" id="card-title">{p.name}</h2>
      {where && <div class="where"><Pin />{where}</div>}
      {spec && <p class="one">{spec}</p>}

      {!done && !soon && (
        <div class="price">
          <h3>Price</h3>
          {p.price?.from && p.price.label ? (
            <>
              <b>{p.price.label}</b>
              {(p.price.range || p.price.source) && (
                <small>
                  {p.price.range}{p.price.range && p.price.source && ' · '}
                  {p.price.source && <>indicative, via <a href={p.price.source.url} {...ext}>{p.price.source.name}</a></>}
                </small>
              )}
            </>
          ) : <><b>On request</b><small>Call us for today's price</small></>}
        </div>
      )}

      {facts.length > 0 && (
        <dl class="facts">
          {facts.map((f, i) => (
            <div class={i === facts.length - 1 && facts.length % 2 ? 'wide' : ''}><dt>{f.k}</dt><dd>{f.v}{f.sub && <small>{f.sub}</small>}</dd></div>
          ))}
        </dl>
      )}

      {!done && p.driveTimes.length > 0 && (
        <div class="drive">
          <h3>How far by car</h3>
          <ul>{p.driveTimes.map((d) => <li key={d.id}><Car /><span>{toPlace(d)} · <b>{d.time}</b></span></li>)}</ul>
          <p>Estimated from distance; traffic varies.</p>
        </div>
      )}

      {p.highlights.length > 0 && (
        <div class="hl"><h3>{done ? 'About' : 'Highlights'}</h3><div>{p.highlights.map((h) => <span>{h}</span>)}</div></div>
      )}
      {done && <p class="note">Built and handed over to {p.scale.units ? count(p.scale.units, 'family', 'families') : 'its families'}. Homes here are sold only on resale.</p>}
      {trust && <div class="trust"><Shield />{trust}</div>}

      <div class="acts">
        {btns.filter((b) => b.pri).map((b) => <a class="btn pri" href={b.href} {...(b.ext ? ext : {})}>{b.icon}{b.label}</a>)}
        {/* The rest share one compact row so the bar does not cover the card at half height. */}
        <div class="more">
          {btns.filter((b) => !b.pri).map((b) => <a class="btn" href={b.href} {...(b.ext ? ext : {})}>{b.icon}{b.label}</a>)}
        </div>
        {!done && phoneText && <p class="call">Call us: <b>{phoneText}</b></p>}
      </div>
    </article>
  );
}
