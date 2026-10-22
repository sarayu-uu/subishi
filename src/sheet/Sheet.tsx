import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import './sheet.css';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];
const GRAB = 24; // handle strip at the top of the sheet
export const PEEK = 164;
/** How much of the screen the sheet covers at a snap point (full ≈ the whole screen). */
export const sheetPx = (s: Snap) => (s === 'peek' ? PEEK : s === 'half' ? Math.round(innerHeight * 0.56) : innerHeight);

type Props = {
  snap: Snap; onSnap: (s: Snap) => void; shown: boolean; wide: boolean;
  /** Changes when the content is swapped (list ↔ card); scrolls back to the top. */
  contentKey: string; children: ComponentChildren;
};

/**
 * Bottom sheet with three snap points. Drag the handle (pointer events) or the content (touch: only when it is
 * scrolled to the top, or the sheet is not yet full). A flick carries on in its direction. From 900 px wide it is a
 * fixed left panel and none of this applies.
 */
export function Sheet({ snap, onSnap, shown, wide, contentKey, children }: Props) {
  const sheet = useRef<HTMLElement>(null), scroller = useRef<HTMLDivElement>(null);
  const live = useRef({ snap, wide, onSnap });
  live.current = { snap, wide, onSnap };

  const height = () => sheet.current!.offsetHeight;
  const offset = (s: Snap) => (s === 'full' ? 0 : Math.max(0, height() - sheetPx(s)));
  /** Move the sheet and size the scroll area to the part on screen, so the sticky action bar stays reachable. */
  const place = (y: number) => {
    const el = sheet.current!, sc = scroller.current!;
    if (live.current.wide) { el.style.transform = ''; sc.style.height = ''; return; }
    el.style.transform = `translateY(${y}px)`;
    sc.style.height = `${Math.max(0, height() - y - GRAB)}px`;
  };

  useLayoutEffect(() => { place(shown ? offset(snap) : height() + 24); }, [snap, shown, wide]);
  useLayoutEffect(() => { scroller.current!.scrollTop = 0; }, [contentKey]);
  useEffect(() => {
    const onResize = () => place(offset(live.current.snap));
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  // ---- dragging ----
  const drag = useRef({ y0: 0, s0: 0, samples: [] as [number, number][] });
  const start = (y: number) => {
    drag.current = { y0: y, s0: offset(live.current.snap), samples: [[performance.now(), y]] };
    sheet.current!.classList.add('dragging');
  };
  const move = (y: number) => {
    const d = drag.current;
    d.samples.push([performance.now(), y]);
    if (d.samples.length > 6) d.samples.shift();
    place(Math.max(0, d.s0 + y - d.y0));
  };
  /** Land on the snap point nearest to where the sheet would coast to in the next ~200 ms. */
  const end = (y: number) => {
    const d = drag.current;
    sheet.current!.classList.remove('dragging');
    const [t0, y0] = d.samples[0], v = (y - y0) / Math.max(1, performance.now() - t0);
    const coast = d.s0 + y - d.y0 + v * 200;
    const next = ORDER.reduce((a, b) => (Math.abs(offset(b) - coast) < Math.abs(offset(a) - coast) ? b : a));
    place(offset(next)); // the snap may not change, so put the sheet back explicitly
    if (next !== live.current.snap) live.current.onSnap(next);
  };
  const step = (dir: 1 | -1) => ORDER[Math.min(2, Math.max(0, ORDER.indexOf(live.current.snap) + dir))];

  // Handle: pointer events. A tap without movement steps the sheet up (full → half).
  const grab = useRef<{ id: number; moved: boolean } | null>(null);
  const onDown = (e: PointerEvent) => {
    if (live.current.wide) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    grab.current = { id: e.pointerId, moved: false };
    start(e.clientY);
  };
  const onMove = (e: PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    if (Math.abs(e.clientY - drag.current.y0) > 6) g.moved = true;
    if (g.moved) move(e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    grab.current = null;
    if (g.moved && e.type === 'pointerup') return end(e.clientY);
    sheet.current!.classList.remove('dragging');
    place(offset(live.current.snap));
    if (e.type === 'pointerup') onSnap(snap === 'full' ? 'half' : step(1));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSnap(snap === 'full' ? 'peek' : step(1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onSnap(step(1)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); onSnap(step(-1)); }
  };

  // Content: touch events, because only touchmove can stop the list from scrolling while the sheet moves.
  useEffect(() => {
    const sc = scroller.current!;
    let x0 = 0, y0 = 0, mode: 'undecided' | 'drag' | 'scroll' = 'scroll';
    const ts = (e: TouchEvent) => {
      if (live.current.wide || e.touches.length > 1) { mode = 'scroll'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; mode = 'undecided';
    };
    const tm = (e: TouchEvent) => {
      if (mode === 'scroll') return;
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0, full = live.current.snap === 'full';
      if (mode === 'undecided') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) { if (!full && Math.abs(dy) >= Math.abs(dx)) e.preventDefault(); return; }
        // Sideways swipes (area chips) and normal scrolling of a full sheet are left to the browser.
        if (Math.abs(dx) > Math.abs(dy) || (full && (sc.scrollTop > 0 || dy < 0))) { mode = 'scroll'; return; }
        mode = 'drag'; start(y0);
      }
      e.preventDefault();
      move(t.clientY);
    };
    const te = (e: TouchEvent) => { if (mode === 'drag') end(e.changedTouches[0].clientY); mode = 'scroll'; };
    sc.addEventListener('touchstart', ts, { passive: true });
    sc.addEventListener('touchmove', tm, { passive: false });
    sc.addEventListener('touchend', te);
    sc.addEventListener('touchcancel', te);
    return () => { sc.removeEventListener('touchstart', ts); sc.removeEventListener('touchmove', tm); sc.removeEventListener('touchend', te); sc.removeEventListener('touchcancel', te); };
  }, []);

  // Wheel or keyboard scrolling in a half-open sheet opens it fully.
  const onScroll = () => { if (!wide && snap !== 'full' && scroller.current!.scrollTop > 0 && !sheet.current!.classList.contains('dragging')) onSnap('full'); };

  const state = snap === 'peek' ? 'collapsed' : snap === 'half' ? 'half open' : 'fully open';
  return (
    <section ref={sheet} class={`sheet${shown ? ' on' : ''}${snap === 'peek' && !wide ? ' lock' : ''}`} aria-label="Projects">
      <div class="grab" role="button" tabIndex={wide ? -1 : 0} aria-label={`Projects panel, ${state}. Press to resize.`}
        aria-expanded={snap !== 'peek'} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey} />
      <div class="scroller" ref={scroller} onScroll={onScroll}>{children}</div>
    </section>
  );
}
