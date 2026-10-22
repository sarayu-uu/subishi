import { useEffect, useRef, useState } from 'preact/hooks';
import type { Project } from '../types';
import { ANY, QUESTIONS, fits, type Choice } from './filters';
import { count } from '../sheet/format';
import './filters.css';

type Props = { initial: Choice; projects: Project[]; onApply: (c: Choice) => void; onClose: () => void };

/** Bottom panel with the three questions. Choices apply when you press "Show N homes"; closing discards them. */
export function FilterPanel({ initial, projects, onApply, onClose }: Props) {
  const [draft, setDraft] = useState(initial);
  const panel = useRef<HTMLDivElement>(null);
  const n = projects.filter((p) => fits(p, draft)).length;

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    return () => back?.focus({ preventScroll: true });
  }, []);

  // Keep Tab inside the panel and let Escape close it.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...panel.current!.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };

  return (
    <div class="fp-wrap" onKeyDown={onKey}>
      <div class="fp-back" onClick={onClose} />
      <div class="fp" role="dialog" aria-modal="true" aria-labelledby="fp-title" ref={panel}>
        <div class="fp-head">
          <h2 id="fp-title">What are you looking for?</h2>
          <button class="fp-x" aria-label="Close" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div class="fp-body">
          {(Object.keys(QUESTIONS) as (keyof Choice)[]).map((k) => {
            const q = QUESTIONS[k];
            return (
              <section key={k}>
                <h3 id={`fp-${k}`}>{q.title}</h3>
                <div class={`fp-opts${q.options.length === 4 ? ' four' : ''}`} role="group" aria-labelledby={`fp-${k}`}>
                  {q.options.map((o) => (
                    <button aria-pressed={draft[k] === o.id ? 'true' : 'false'} onClick={() => setDraft((d) => ({ ...d, [k]: o.id }))}>
                      <b>{o.label}</b>{o.hint && <small>{o.hint}</small>}
                    </button>
                  ))}
                </div>
                {q.note && <p class="fp-note">{q.note}</p>}
              </section>
            );
          })}
        </div>
        <div class="fp-foot">
          <button class="fp-clear" onClick={() => setDraft(ANY)}>Clear all</button>
          <button class="fp-go" disabled={!n} onClick={() => onApply(draft)}>{n ? `Show ${count(n, 'home')}` : 'No homes match that'}</button>
        </div>
      </div>
    </div>
  );
}
