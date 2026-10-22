import { useState } from 'preact/hooks';
import type { Emi as EmiDefaults } from '../types';

type Terms = { down: number; rate: number; years: number };
const STEP: Record<keyof Terms, { min: number; max: number; step: number; label: string; unit: (v: number) => string }> = {
  down: { min: 10, max: 50, step: 5, label: 'Down payment', unit: (v) => `${v}%` },
  rate: { min: 7, max: 12, step: 0.25, label: 'Interest rate', unit: (v) => `${v}%` },
  years: { min: 5, max: 30, step: 1, label: 'Loan length', unit: (v) => `${v} years` },
};
const KEY = 'subishi-emi'; // this visitor's own terms, remembered on this device only

/** Monthly instalment: loan·r·(1+r)^n / ((1+r)^n − 1), with r the monthly rate and n the number of months. */
export function monthly(price: number, t: Terms) {
  const loan = price * (1 - t.down / 100), r = t.rate / 12 / 100, n = t.years * 12, k = (1 + r) ** n;
  return (loan * r * k) / (k - 1);
}
/** Nearest ₹1,000, in lakh from ₹1 L: "₹3.44 L", otherwise "₹47,000". */
export function rupees(x: number) {
  const v = Math.round(x / 1000) * 1000;
  return v >= 100_000 ? `₹${String(+(v / 100_000).toFixed(2))} L` : `₹${v.toLocaleString('en-IN')}`;
}

const valid = (t: Partial<Terms> | null): t is Terms =>
  !!t && (Object.keys(STEP) as (keyof Terms)[]).every((k) => typeof t[k] === 'number' && t[k]! >= STEP[k].min && t[k]! <= STEP[k].max);

function load(d: EmiDefaults): Terms {
  try { const t = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (valid(t)) return t; } catch { /* private mode or bad data */ }
  return { down: d.downPaymentPct, rate: d.ratePct, years: d.years };
}

export function Emi({ price, defaults }: { price: number; defaults: EmiDefaults }) {
  const [t, setT] = useState(() => load(defaults));
  const [open, setOpen] = useState(false);
  const set = (k: keyof Terms, dir: 1 | -1) => setT((cur) => {
    const s = STEP[k], next = { ...cur, [k]: Math.min(s.max, Math.max(s.min, Math.round((cur[k] + dir * s.step) * 100) / 100)) };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved; still works for this visit */ }
    return next;
  });
  return (
    <div class="emi">
      <p class="emi-v">≈ <b>{rupees(monthly(price, t))}/month</b> EMI</p>
      <p class="emi-t">
        {t.down}% down · {t.rate}% · {t.years} years.{' '}
        {/* The note names the assumed rate, so it only fits while that rate is in use. */}
        {t.rate === defaults.ratePct && defaults.note ? defaults.note : "Your bank's rate may differ."}{' '}
        <button class="emi-change" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Done' : 'Change'}</button>
      </p>
      {open && (
        <div class="emi-panel">
          {(Object.keys(STEP) as (keyof Terms)[]).map((k) => {
            const s = STEP[k];
            return (
              <div class="step" role="group" aria-label={s.label} key={k}>
                <span>{s.label}</span>
                <button type="button" aria-label={`Less ${s.label.toLowerCase()}`} disabled={t[k] <= s.min} onClick={() => set(k, -1)}>−</button>
                <output aria-live="polite">{s.unit(t[k])}</output>
                <button type="button" aria-label={`More ${s.label.toLowerCase()}`} disabled={t[k] >= s.max} onClick={() => set(k, 1)}>+</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
