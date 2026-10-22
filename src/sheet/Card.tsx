import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Brand, Project, Status, Zone } from '../types';
import { badge, count, oneLine, possession, toPlace } from './format';
import { Emi } from './Emi';
import { Back, Briefcase, Cap, Car, Cross, Doc, External, Phone, Pin, Plane, Play, Share, Shield, Sparkle } from './icons';

type Props = { p: Project; status: Status; zone?: Zone; brand: Brand; onBack: () => void; onShare: () => void };
type Fact = { k: string; v: string; sub?: string };
type Btn = { href: string; label: string; icon: JSX.Element; pri?: boolean; ext?: boolean };
const ext = { target: '_blank', rel: 'noopener' };
const PLACE_ICON: Record<string, () => JSX.Element> = { school: Cap, hospital: Cross, jobs: Briefcase, transport: Plane };

export function Card({ p, status, zone, brand, onBack, onShare }: Props) {
  const done = p.status === 'delivered', soon = p.status === 'upcoming';
  const [heroOk, setHeroOk] = useState(true);
  const [shown, setShown] = useState(false); // photo fades in once it has loaded
  const title = useRef<HTMLHeadingElement>(null), img = useRef<HTMLImageElement>(null), acts = useRef<HTMLDivElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true }); // screen readers start at the name; no ring after a tap (focus-visible)
    if (img.current?.complete && img.current.naturalWidth) setShown(true); // already cached
    // With large text the sticky action bar can cover most of the card (over 60% of what is visible); then let it sit at the end instead.
    const bar = acts.current!, sc = bar.closest('.scroller') as HTMLElement | null;
    if (!sc) return;
    const fit = () => bar.classList.toggle('flow', bar.offsetHeight > sc.clientHeight * 0.6);
    const ro = new ResizeObserver(fit);
    ro.observe(bar); ro.observe(sc);
    return () => ro.disconnect();
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
  // Built by Subishi: homes there only change hands on resale, so calling is the useful first step.
  const callFirst = done && !!phone;
  if (callFirst) btns.push({ href: `tel:${phone}`, label: 'Call', icon: <Phone />, pri: true });
  if (L.video) btns.push({ href: L.video, label: video, icon: <Play />, pri: !callFirst, ext: true });
  if (L.website) btns.push({ href: L.website, label: 'Visit site', icon: <External />, pri: !callFirst && !L.video, ext: true });
  if (L.brochure) btns.push({ href: L.brochure, label: 'Brochure', icon: <Doc />, ext: true });
  if (!soon) btns.push({ href: `https://www.google.com/maps/dir/?api=1&destination=${p.location.lat},${p.location.lng}`, label: 'Directions', icon: <Pin />, ext: true });
  if (!done && phone) btns.push({ href: `tel:${phone}`, label: 'Call', icon: <Phone /> });
  const trust = [p.approvals.rera && `RERA ${p.approvals.rera}`, p.approvals.authority && `${p.approvals.authority} approved`].filter(Boolean).join(' · ');

  return (
    <article class="card" aria-labelledby="card-title">
      <button class="back" type="button" onClick={onBack}><Back />All homes</button>
      <div class="hero">
        {p.media.hero && heroOk
          ? <img ref={img} class={shown ? 'in' : ''} src={p.media.hero} alt={p.name} fetchpriority="high" decoding="async"
              onLoad={() => setShown(true)} onError={() => setHeroOk(false)} />
          : <div class="soonart"><div><Sparkle /><b>{p.name}</b><span>{soon ? 'Coming soon' : status.label}</span></div></div>}
        <span class="badge" style={{ '--c': status.color }}><i />{badge(p, status)}</span>
      </div>
      <h2 class="title" id="card-title" tabIndex={-1} ref={title}>{p.name}</h2>
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
      {!done && !soon && p.price?.from && brand.emi && <Emi price={p.price.from} defaults={brand.emi} />}

      {facts.length > 0 && (
        <dl class="facts">
          {facts.map((f, i) => (
            <div class={i === facts.length - 1 && facts.length % 2 ? 'wide' : ''}><dt>{f.k}</dt><dd>{f.v}{f.sub && <small>{f.sub}</small>}</dd></div>
          ))}
        </dl>
      )}

      {p.driveTimes.length > 0 && (
        <div class="drive">
          <h3>How far by car</h3>
          <ul>{p.driveTimes.map((d) => {
            const Icon = PLACE_ICON[d.category] ?? Car;
            return <li key={d.id}><Icon /><span class="dt"><span class="dt-1">{toPlace(d)} · <b>{d.time}</b></span>{d.area && <small>{d.area}</small>}</span></li>;
          })}</ul>
          <p>Estimated from distance; traffic varies.{p.driveTimes.some((d) => d.approx) && ' Some school locations are approximate.'}</p>
        </div>
      )}

      {p.highlights.length > 0 && (
        <div class="hl"><h3>{done ? 'About' : 'Highlights'}</h3><div>{p.highlights.map((h) => <span>{h}</span>)}</div></div>
      )}
      {done && <p class="note">Built and handed over to {p.scale.units ? count(p.scale.units, 'family', 'families') : 'its families'}. Resale homes here sometimes come up. Call to ask.</p>}
      {trust && <div class="trust"><Shield />{trust}</div>}

      <div class="acts" ref={acts}>
        <div class="lead">
          {btns.filter((b) => b.pri).map((b) => <a class="btn pri" href={b.href} {...(b.ext ? ext : {})}>{b.icon}{b.label}</a>)}
          <button class="btn share" type="button" onClick={onShare}><Share />Share with family</button>
        </div>
        {/* The rest share one compact row so the bar does not cover the card at half height. */}
        <div class="more">
          {btns.filter((b) => !b.pri).map((b) => <a class="btn" href={b.href} {...(b.ext ? ext : {})}>{b.icon}{b.label}</a>)}
        </div>
        {phoneText && <p class="call">Call us: <b>{phoneText}</b></p>}
      </div>
    </article>
  );
}
