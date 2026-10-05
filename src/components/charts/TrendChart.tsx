import { useEffect, useId, useState } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import { useElementSize } from '../../hooks/useElementSize';
import { formatInteger } from './layout/format';
import { nearestIndex, trendDomain, validateTrendSeries, type TrendSeries } from './layout/trend';

interface TrendChartProps {
  /** X categories in order (months, weeks…). */
  categories: readonly string[];
  /** Exactly one primary series and at most one comparison (principle 14). */
  series: readonly TrendSeries[];
  label: string;
  height?: number;
  formatValue?: (value: number) => string;
  /** Shade the primary series down to zero in its own hue (principle 15). */
  area?: boolean;
  /** Label each series at its last point instead of relying on a legend (principle 28). */
  directLabels?: boolean;
}

const M = { top: 16, bottom: 26, left: 46 };
const LABEL_BLOCK = 30;

/** End-of-line labels; when the two series end close together the lower label moves down to stay readable. */
function directLabelPositions(
  series: Array<TrendSeries | undefined>,
  lastIndex: (s: TrendSeries) => number,
  y: (v: number) => number
) {
  const placed = series
    .filter((s): s is TrendSeries => Boolean(s))
    .map((s) => {
      const i = lastIndex(s);
      const v = i >= 0 ? (s.values[i] ?? 0) : 0;
      return { s, i, v, labelY: y(v) };
    })
    .filter((p) => p.i >= 0)
    .sort((a, b) => a.labelY - b.labelY);
  for (let k = 1; k < placed.length; k++) {
    const prev = placed[k - 1];
    const cur = placed[k];
    if (prev && cur && cur.labelY - prev.labelY < LABEL_BLOCK) cur.labelY = prev.labelY + LABEL_BLOCK;
  }
  return placed;
}

/**
 * Line / area trend (light mockup "Performance trend", dark mockup "Service requests"): one dominant
 * series, a quieter dashed comparison, a soft grid, no axis titles. The line draws once; hover or the
 * arrow keys move a crosshair with a high-contrast tooltip (principle 29).
 */
export function TrendChart({
  categories,
  series,
  label,
  height = 260,
  formatValue = formatInteger,
  area = true,
  directLabels = true,
}: TrendChartProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>({ width: 640, height: 0 });
  const [active, setActive] = useState<number | null>(null);
  const gradientId = `u-area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const problems = validateTrendSeries(series);
    if (import.meta.env.DEV && problems.length) console.warn(`[TrendChart] "${label}": ${problems.join('; ')}`);
  }, [series, label]);

  const primary = series.find((s) => s.role === 'primary');
  const comparison = series.find((s) => s.role === 'comparison');
  const right = directLabels ? 84 : 16;
  const innerW = Math.max(40, width - M.left - right);
  const innerH = Math.max(40, height - M.top - M.bottom);

  const indexes = categories.map((_, i) => i);
  const x = scalePoint<number>().domain(indexes).range([0, innerW]);
  const [lo, hi] = trendDomain(series, { zero: area });
  const y = scaleLinear().domain([lo, hi]).range([innerH, 0]);
  const ticks = y.ticks(4);
  const px = (i: number) => x(i) ?? 0;
  const positions = indexes.map(px);

  const line = d3Line<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => px(i))
    .y((v) => y(v ?? 0))
    .curve(curveMonotoneX);
  const shade = d3Area<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => px(i))
    .y0(y(Math.max(lo, Math.min(0, hi))))
    .y1((v) => y(v ?? 0))
    .curve(curveMonotoneX);

  const lastIndex = (s: TrendSeries) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return i;
    return -1;
  };
  const labelEvery = Math.max(1, Math.ceil((categories.length * 44) / innerW));
  const activeValue = (s?: TrendSeries) => (s && active !== null ? (s.values[active] ?? null) : null);

  const tooltipLeft = active !== null ? Math.min(Math.max(M.left + px(active), M.left + 50), M.left + innerW - 50) : 0;
  const tooltipTop = active !== null ? M.top + y(activeValue(primary) ?? hi) : 0;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="block focus:outline-none focus-visible:rounded-md focus-visible:shadow-[var(--u-focus-ring)]"
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const current = active ?? categories.length - 1;
          setActive(Math.max(0, Math.min(categories.length - 1, current + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--u-area)', stopOpacity: 'var(--u-area-opacity)' }} />
            <stop offset="1" style={{ stopColor: 'var(--u-area)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        <g transform={`translate(${M.left},${M.top})`}>
          {/* The grid disappears before the data does (principle 26) */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--u-grid)', strokeDasharray: 'var(--u-grid-dash)' }} />
              <text x={-10} y={y(t) + 4} textAnchor="end" style={{ font: '500 11px var(--u-font-body)', fill: 'var(--u-axis)' }}>
                {formatValue(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) =>
            i % labelEvery === 0 || i === categories.length - 1 ? (
              <text key={c} x={px(i)} y={innerH + 18} textAnchor="middle" style={{ font: '500 11px var(--u-font-body)', fill: 'var(--u-axis)' }}>
                {c}
              </text>
            ) : null
          )}

          {/* Series draw once, left to right */}
          <g style={{ animation: 'u-wipe 1.6s var(--u-ease) .3s both' }}>
            {area && primary && <path d={shade(primary.values) ?? ''} fill={`url(#${gradientId})`} />}
            {comparison && (
              <path
                d={line(comparison.values) ?? ''}
                fill="none"
                style={{ stroke: 'var(--u-secondary)', strokeWidth: 1.8, strokeDasharray: '4 5', strokeLinecap: 'round' }}
              />
            )}
            {primary && (
              <path
                d={line(primary.values) ?? ''}
                fill="none"
                style={{ stroke: 'var(--u-primary)', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}
              />
            )}
          </g>

          {directLabels &&
            directLabelPositions([primary, comparison], lastIndex, (v) => y(v)).map(({ s, i, v, labelY }) => (
              <g key={s.id} style={{ animation: 'u-fade .6s var(--u-ease) 1.6s both' }}>
                <text x={px(i) + 10} y={labelY - 2} style={{ font: `600 11.5px var(--u-font-body)`, fill: s.role === 'primary' ? 'var(--u-title)' : 'var(--u-label)' }}>
                  {s.label}
                </text>
                <text x={px(i) + 10} y={labelY + 12} className="u-num" style={{ font: '600 11px var(--u-font-display)', fill: s.role === 'primary' ? 'var(--u-primary)' : 'var(--u-label)' }}>
                  {formatValue(v)}
                </text>
              </g>
            ))}

          {active !== null && (
            <g pointerEvents="none">
              <line x1={px(active)} x2={px(active)} y1={0} y2={innerH} style={{ stroke: 'var(--u-interaction)', strokeOpacity: 0.5, strokeDasharray: '3 4' }} />
              {comparison && activeValue(comparison) !== null && (
                <circle cx={px(active)} cy={y(activeValue(comparison) ?? 0)} r={4} style={{ fill: 'var(--u-card-solid)', stroke: 'var(--u-secondary)', strokeWidth: 2 }} />
              )}
              {primary && activeValue(primary) !== null && (
                <circle cx={px(active)} cy={y(activeValue(primary) ?? 0)} r={6} style={{ fill: 'var(--u-card-solid)', stroke: 'var(--u-interaction)', strokeWidth: 3 }} />
              )}
            </g>
          )}

          {/* Pointer capture */}
          <rect
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setActive(nearestIndex(positions, e.clientX - box.left));
            }}
          />
        </g>
      </svg>

      {active !== null && primary && (
        <div className="u-tooltip absolute" style={{ left: tooltipLeft, top: tooltipTop - 14, transform: 'translate(-50%, -100%)' }} role="status">
          <span className="block text-[10px] uppercase tracking-[0.08em]">{categories[active]}</span>
          <b className="u-num">{activeValue(primary) !== null ? formatValue(activeValue(primary) ?? 0) : '—'}</b>{' '}
          <span>{primary.label}</span>
          {comparison && (
            <span className="block">
              {comparison.label}: {activeValue(comparison) !== null ? formatValue(activeValue(comparison) ?? 0) : '—'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
