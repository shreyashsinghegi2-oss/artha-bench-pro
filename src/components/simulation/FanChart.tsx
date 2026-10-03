import React, { useMemo, useRef, useState } from 'react';
import type { YearBand } from '../../simulation/monte-carlo';

export const inrShort = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

/**
 * Fan chart: 5–95% and 25–75% bands of simulated wealth by year, the median line and the amount invested.
 * One hue (brand) at two strengths for the bands; invested is a neutral dashed line. Hover shows a crosshair
 * with every value for that year; a table view carries the same numbers.
 */
export const FanChart: React.FC<{ bands: YearBand[]; height?: number; compact?: boolean; title: string }> = ({
  bands,
  height = 300,
  compact = false,
  title,
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const ref = useRef<SVGSVGElement>(null);
  const W = 640;
  const H = height;
  const pad = { l: compact ? 8 : 64, r: 118, t: 12, b: 28 };
  const maxY = useMemo(() => Math.max(...bands.map((b) => Math.max(b.p95, b.invested))) * 1.05 || 1, [bands]);
  const years = bands.length - 1 || 1;
  const x = (i: number) => pad.l + (i / years) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const area = (lo: keyof YearBand, hi: keyof YearBand) =>
    `M${bands.map((b, i) => `${x(i)},${y(b[hi] as number)}`).join('L')}L${[...bands]
      .reverse()
      .map((b, i) => `${x(bands.length - 1 - i)},${y(b[lo] as number)}`)
      .join('L')}Z`;
  const line = (k: keyof YearBand) => `M${bands.map((b, i) => `${x(i)},${y(b[k] as number)}`).join('L')}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
  const last = bands[bands.length - 1];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * years);
    setHover(Math.max(0, Math.min(years, i)));
  };
  const h = hover !== null ? bands[hover] : null;
  const endLabels = last
    ? [
        { v: last.p95, t: `95%: ${inrShort(last.p95)}` },
        { v: last.p50, t: `Median: ${inrShort(last.p50)}` },
        { v: last.p5, t: `5%: ${inrShort(last.p5)}` },
      ]
    : [];
  // Keep end labels at least 14px apart.
  const placed: number[] = [];
  for (const l of endLabels) {
    let py = y(l.v);
    for (const p of placed) if (Math.abs(p - py) < 14) py = p + 14;
    placed.push(py);
  }

  return (
    <figure className="m-0 min-w-0">
      <figcaption className="sr-only">{title}</figcaption>
      {!table ? (
        <div className="relative">
          <svg
            ref={ref}
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full touch-none select-none"
            role="img"
            aria-label={`${title}. Median after ${years} years ${last ? inrShort(last.p50) : ''}; 5% worst ${last ? inrShort(last.p5) : ''}; 95% best ${last ? inrShort(last.p95) : ''}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" strokeWidth={1} />
                {!compact && (
                  <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-secondary)">
                    {inrShort(t)}
                  </text>
                )}
              </g>
            ))}
            {bands.map((b, i) =>
              years <= 12 || i % Math.ceil(years / 10) === 0 || i === years ? (
                <text key={b.year} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-secondary)">
                  {i === 0 ? 'Now' : `Y${b.year}`}
                </text>
              ) : null,
            )}
            <path d={area('p5', 'p95')} fill="var(--color-brand)" fillOpacity={0.14} />
            <path d={area('p25', 'p75')} fill="var(--color-brand)" fillOpacity={0.28} />
            <path d={line('invested')} fill="none" stroke="var(--color-secondary)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={line('p50')} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinejoin="round" />
            {endLabels.map((l, k) => (
              <text
                key={l.t}
                x={W - pad.r + 6}
                y={(placed[k] ?? 0) + 4}
                fontSize={11}
                fill={k === 1 ? 'var(--color-ink)' : 'var(--color-secondary)'}
                fontWeight={k === 1 ? 700 : 400}
              >
                {l.t}
              </text>
            ))}
            {h && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-line-strong)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(h.p50)} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
          {h && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
              style={{ left: `${Math.min(70, Math.max(2, (x(hover) / W) * 100 - 12))}%` }}
              role="status"
            >
              <p className="font-semibold text-ink">{hover === 0 ? 'Now' : `After ${h.year} year${h.year > 1 ? 's' : ''}`}</p>
              <p className="text-secondary">
                Best 5%: <b className="text-ink">{inrShort(h.p95)}</b>
              </p>
              <p className="text-secondary">
                Middle 50%: <b className="text-ink">{inrShort(h.p25)}</b> – <b className="text-ink">{inrShort(h.p75)}</b>
              </p>
              <p className="text-secondary">
                Median: <b className="text-ink">{inrShort(h.p50)}</b>
              </p>
              <p className="text-secondary">
                Worst 5%: <b className="text-ink">{inrShort(h.p5)}</b>
              </p>
              <p className="text-secondary">
                Invested: <b className="text-ink">{inrShort(h.invested)}</b>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-right text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface text-secondary">
              <tr>
                <th className="py-1 text-left font-semibold">Year</th>
                <th className="py-1 font-semibold">Invested</th>
                <th className="py-1 font-semibold">5%</th>
                <th className="py-1 font-semibold">25%</th>
                <th className="py-1 font-semibold">Median</th>
                <th className="py-1 font-semibold">75%</th>
                <th className="py-1 font-semibold">95%</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {bands.map((b) => (
                <tr key={b.year} className="border-t border-line">
                  <td className="py-1 text-left">{b.year}</td>
                  <td>{inrShort(b.invested)}</td>
                  <td>{inrShort(b.p5)}</td>
                  <td>{inrShort(b.p25)}</td>
                  <td className="font-semibold">{inrShort(b.p50)}</td>
                  <td>{inrShort(b.p75)}</td>
                  <td>{inrShort(b.p95)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-brand/15" aria-hidden /> 5–95% of outcomes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-brand/30" aria-hidden /> middle 50%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand" aria-hidden /> median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-secondary" aria-hidden /> amount invested
        </span>
        <button type="button" onClick={() => setTable((v) => !v)} className="ml-auto font-semibold text-interactive underline">
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
    </figure>
  );
};
