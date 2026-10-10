import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { RANK_BANDS, contests, rankFor } from '../../data/codeforces.ts';
import { formatDate, monthYear } from '../lib.ts';

// Codeforces rating after each rated contest, on a time axis, over the rank bands. One series, so
// no legend box: the caption names it. Hover (or arrow keys when focused) shows one contest; the
// table under the chart has every value.

const W = 720;
const H = 276;
const M = { l: 44, r: 92, t: 14, b: 30 };
const Y0 = 200;
const Y1 = 1900;
const PLOT_W = W - M.l - M.r;
const PLOT_H = H - M.t - M.b;

const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const T0 = time(contests[0].date);
const T1 = time(contests[contests.length - 1].date);
const round = (v: number) => Math.round(v * 10) / 10;
const x = (t: number) => round(M.l + ((t - T0) / (T1 - T0)) * PLOT_W);
const y = (r: number) => round(M.t + (1 - (Math.min(Math.max(r, Y0), Y1) - Y0) / (Y1 - Y0)) * PLOT_H);

const POINTS = contests.map((c, i) => ({ i, c, x: x(time(c.date)), y: y(c.newRating) }));
const LINE = POINTS.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
const FIRST = POINTS[0];
const LAST = POINTS[POINTS.length - 1];

const BANDS = RANK_BANDS.map(([lo, name, color], k) => {
  const hi = RANK_BANDS[k + 1]?.[0] ?? Infinity;
  return { name, color, lo: Math.max(lo, Y0), hi: Math.min(hi, Y1) };
}).filter((b) => b.hi > b.lo);

const Y_TICKS = [400, 800, 1200, 1400, 1600];
const YEARS = (() => {
  const out: { year: number; x: number }[] = [];
  const first = new Date(T0).getUTCFullYear();
  const last = new Date(T1).getUTCFullYear();
  for (let yr = first + 1; yr <= last; yr++) out.push({ year: yr, x: x(Date.UTC(yr, 0, 1)) });
  return out;
})();

export const RATING_SUMMARY = `Codeforces rating from ${contests[0].newRating} in ${monthYear(contests[0].date)} to ${contests[contests.length - 1].newRating} in ${monthYear(contests[contests.length - 1].date)}, over ${contests.length} rated contests.`;

function nearest(px: number): number {
  let best = 0;
  let dist = Infinity;
  for (const p of POINTS) {
    const d = Math.abs(p.x - px);
    if (d < dist) {
      dist = d;
      best = p.i;
    }
  }
  return best;
}

function delta(i: number): string | null {
  const c = contests[i];
  if (c.oldRating === 0) return null;
  const d = c.newRating - c.oldRating;
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0';
}

export function RatingChart({ interactive = true, table = true }: { interactive?: boolean; table?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // On narrow screens the plot scrolls sideways: start at the latest contests.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (frame) frame.scrollLeft = frame.scrollWidth;
  }, []);
  const p = active === null ? null : POINTS[active];
  const rank = p ? rankFor(p.c.newRating) : null;
  const d = active === null ? null : delta(active);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setActive(nearest(((e.clientX - r.left) / r.width) * W));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = POINTS.length - 1;
    const at = active ?? last;
    const next = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(last, next)));
  };

  return (
    <figure className="cv-chart">
      <figcaption className="cv-chart__caption">
        <span className="cv-chart__title">Codeforces rating after each rated contest</span>
        <span className="cv-chart__sub">{RATING_SUMMARY}</span>
      </figcaption>
      <div
        className="cv-chart__frame"
        ref={frameRef}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'group' : undefined}
        aria-label={interactive ? 'Rating chart. Left and right arrow keys step through the contests.' : undefined}
        onKeyDown={interactive ? onKey : undefined}
        onFocus={interactive ? () => setActive((a) => a ?? POINTS.length - 1) : undefined}
        onBlur={interactive ? () => setActive(null) : undefined}
      >
        <div className="cv-chart__plot">
        <svg ref={svgRef} className="cv-chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={RATING_SUMMARY}>
          {BANDS.map((b) => (
            <g key={b.name}>
              <rect className="cv-chart__band" x={M.l} y={y(b.hi)} width={PLOT_W} height={round(y(b.lo) - y(b.hi))} fill={b.color} />
              <rect className="cv-chart__swatch" x={M.l + PLOT_W + 10} y={round((y(b.hi) + y(b.lo)) / 2 - 5)} width="10" height="10" rx="2" fill={b.color} />
              <text className="cv-chart__band-label" x={M.l + PLOT_W + 25} y={round((y(b.hi) + y(b.lo)) / 2)} dominantBaseline="middle">
                {b.name}
              </text>
            </g>
          ))}
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line className="cv-chart__grid" x1={M.l} x2={M.l + PLOT_W} y1={y(t)} y2={y(t)} />
              <text className="cv-chart__tick" x={M.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          <line className="cv-chart__axis" x1={M.l} x2={M.l + PLOT_W} y1={M.t + PLOT_H} y2={M.t + PLOT_H} />
          <text className="cv-chart__tick" x={FIRST.x} y={M.t + PLOT_H + 18} textAnchor="start">
            {new Date(T0).getUTCFullYear()}
          </text>
          {YEARS.map((yr) => (
            <g key={yr.year}>
              <line className="cv-chart__axis" x1={yr.x} x2={yr.x} y1={M.t + PLOT_H} y2={M.t + PLOT_H + 5} />
              <text className="cv-chart__tick" x={yr.x} y={M.t + PLOT_H + 18} textAnchor="middle">
                {yr.year}
              </text>
            </g>
          ))}
          <path className="cv-chart__line" d={LINE} />
          <circle className="cv-chart__dot" cx={FIRST.x} cy={FIRST.y} r="4.5" />
          <text className="cv-chart__value" x={FIRST.x + 9} y={FIRST.y + 2} dominantBaseline="middle">
            {FIRST.c.newRating}
          </text>
          <circle className="cv-chart__dot" cx={LAST.x} cy={LAST.y} r="4.5" />
          <text className="cv-chart__value" x={LAST.x - 9} y={LAST.y - 12} textAnchor="end">
            {LAST.c.newRating}
          </text>
          {p && (
            <g className="cv-chart__focus" aria-hidden="true">
              <line x1={p.x} x2={p.x} y1={M.t} y2={M.t + PLOT_H} />
              <circle cx={p.x} cy={p.y} r="5" />
            </g>
          )}
          {interactive && <rect className="cv-chart__hit" x={M.l} y={M.t} width={PLOT_W} height={PLOT_H} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />}
        </svg>
        {p && rank && (
          <div className="cv-chart__tip" style={{ '--x': `${(p.x / W) * 100}%`, '--y': `${(p.y / H) * 100}%` } as CSSProperties} data-side={p.x > W * 0.62 ? 'left' : 'right'} aria-hidden="true">
            <span className="cv-chart__tip-value">
              {p.c.newRating}
              {d && <span className="cv-chart__tip-delta">{d}</span>}
            </span>
            <span className="cv-chart__tip-name">{p.c.name}</span>
            <span className="cv-chart__tip-meta">
              {formatDate(p.c.date)} · {rank.name}
            </span>
          </div>
        )}
        </div>
        {interactive && (
          <p className="sr-only" aria-live="polite">
            {p ? `${p.c.newRating}${d ? ` (${d})` : ''}, ${p.c.name}, ${formatDate(p.c.date)}` : ''}
          </p>
        )}
      </div>
      {table && (
        <details className="cv-chart__table">
          <summary>All {contests.length} rated contests as a table</summary>
          <div className="cv-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Date</th>
                  <th scope="col">Contest</th>
                  <th scope="col">Place</th>
                  <th scope="col">Rating</th>
                </tr>
              </thead>
              <tbody>
                {contests.map((c, i) => (
                  <tr key={`${c.date}-${c.name}`}>
                    <td>{i + 1}</td>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.name}</td>
                    <td>{c.rank.toLocaleString('en-US')}</td>
                    <td>
                      {c.newRating}
                      {delta(i) && <span className="cv-table__delta"> ({delta(i)})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
