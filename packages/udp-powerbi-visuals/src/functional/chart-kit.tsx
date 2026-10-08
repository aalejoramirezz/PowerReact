import { h, type FunctionalComponent } from '@stencil/core';
import type { TooltipItem } from '../utils/events';
import { formatValue } from '../utils/formats';
import type { SeriesColour } from '../utils/palette';
import type { ChartSeries } from '../utils/series-chart';

/**
 * Shared chart chrome for the SVG elements. Colours only through var(--pbi-*); the grid disappears
 * before the data (principle 26): thin token lines, no axis titles, no plot borders.
 */

const AXIS_FONT = '500 11px var(--pbi-font-body)';

interface GridLinesProps {
  /** rows: horizontal lines for vertical charts (values on the y axis); columns: vertical lines for bar charts. */
  orientation: 'rows' | 'columns';
  ticks: readonly number[];
  /** Value → pixel along the value axis. */
  pos: (value: number) => number;
  /** Extent of the lines across the other axis. */
  from: number;
  to: number;
  format?: (value: number) => string;
  /** Hide the value labels (e.g. when the bars carry their own). */
  labels?: boolean;
}

/** Value gridlines with their labels; the zero line is drawn a step stronger. */
export const GridLines: FunctionalComponent<GridLinesProps> = ({ orientation, ticks, pos, from, to, format = String, labels = true }) => (
  <g class="u-grid" aria-hidden="true">
    {ticks.map((t) => {
      const p = pos(t);
      const zero = t === 0;
      const line = { stroke: zero ? 'var(--pbi-axis)' : 'var(--pbi-grid)', strokeDasharray: zero ? 'none' : 'var(--pbi-grid-dash)' };
      return orientation === 'rows' ? (
        <g key={`r${t}`}>
          <line x1={from} x2={to} y1={p} y2={p} style={line} />
          {labels && (
            <text x={from - 8} y={p + 4} text-anchor="end" style={{ font: AXIS_FONT, fill: 'var(--pbi-axis)' }}>
              {format(t)}
            </text>
          )}
        </g>
      ) : (
        <g key={`c${t}`}>
          <line x1={p} x2={p} y1={from} y2={to} style={line} />
          {labels && (
            <text x={p} y={to + 15} text-anchor="middle" style={{ font: AXIS_FONT, fill: 'var(--pbi-axis)' }}>
              {format(t)}
            </text>
          )}
        </g>
      );
    })}
  </g>
);

interface ReferenceLineProps {
  orientation: 'horizontal' | 'vertical';
  /** Pixel position of the line. */
  at: number;
  from: number;
  to: number;
  label?: string;
  /** horizontal: a second label line (the value), drawn under the name. */
  detail?: string;
  /** horizontal: label inside the plot's end, at its start (clear of end-of-line labels), or past it in the right margin. */
  labelAt?: 'inside' | 'start' | 'outside';
}

/** A target / average / threshold: a quiet dashed line with its label at the end (direct labelling). */
export const ReferenceLine: FunctionalComponent<ReferenceLineProps> = ({ orientation, at, from, to, label, detail, labelAt = 'inside' }) => {
  const style = { stroke: 'var(--pbi-title)', strokeWidth: '1.2', strokeDasharray: '4 3', opacity: '0.7' };
  const text = { font: '600 10.5px var(--pbi-font-body)', fill: 'var(--pbi-text-soft)' };
  const value = { font: '600 10.5px var(--pbi-font-display)', fill: 'var(--pbi-title)', fontVariantNumeric: 'tabular-nums' };
  if (orientation === 'horizontal' && labelAt === 'outside') {
    return (
      <g class="u-ref" aria-hidden="true">
        <line x1={from} x2={to + 4} y1={at} y2={at} style={style} />
        {label && (
          <text x={to + 8} y={detail ? at - 2 : at + 4} style={text}>
            {label}
          </text>
        )}
        {detail && (
          <text x={to + 8} y={at + 11} style={value}>
            {detail}
          </text>
        )}
      </g>
    );
  }
  return orientation === 'horizontal' ? (
    <g class="u-ref" aria-hidden="true">
      <line x1={from} x2={to} y1={at} y2={at} style={style} />
      {label && (
        <text x={labelAt === 'start' ? from + 4 : to} y={at - 5} text-anchor={labelAt === 'start' ? 'start' : 'end'} style={text}>
          {detail ? `${label} ${detail}` : label}
        </text>
      )}
    </g>
  ) : (
    <g class="u-ref" aria-hidden="true">
      <line x1={at} x2={at} y1={from} y2={to} style={style} />
      {label && (
        <text x={at + 5} y={from + 10} style={text}>
          {label}
        </text>
      )}
    </g>
  );
};

export interface LegendItem {
  label: string;
  /** A token reference, e.g. var(--pbi-series-2). */
  fill: string;
}

/** Small legend near the title (principle 28): swatch + label, reduced contrast. */
export const Legend: FunctionalComponent<{ items: readonly LegendItem[]; label?: string }> = ({ items, label = 'Legend' }) => (
  <ul class="u-legend" aria-label={label}>
    {items.map((item) => (
      <li key={item.label}>
        <i style={{ background: item.fill }} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);

export interface TooltipRow {
  label: string;
  value: string;
  /** Optional swatch (token reference). */
  swatch?: string;
  /** The row of the mark under the pointer / keyboard. */
  active?: boolean;
}

/** Formats a mark's extra `tooltips` measures for the tooltip rows. */
export function tooltipRows(items: readonly TooltipItem[] | undefined): TooltipRow[] {
  return (items ?? []).map((t) => ({
    label: t.label,
    value: typeof t.value === 'number' ? formatValue(t.value, t.format) : (t.value ?? '—'),
  }));
}

/**
 * A category × series tooltip: every series of category `c` (the active one emphasised, with its
 * share when given), the total when the series stack, then the category's extra measures.
 */
export function seriesTooltipRows(
  series: readonly ChartSeries[],
  colours: readonly SeriesColour[],
  c: number,
  {
    active,
    fmt,
    share,
    total,
    extras,
  }: { active: number | null; fmt: (v: number) => string; share?: (k: number) => string | null; total: boolean; extras?: readonly TooltipItem[] }
): TooltipRow[] {
  const many = series.length > 1;
  const rows: TooltipRow[] = series.map((s, k) => {
    const v = s.values[c] ?? null;
    const sh = v === null ? null : (share?.(k) ?? null);
    return {
      label: s.label,
      value: v === null ? '—' : sh ? `${sh} · ${fmt(v)}` : fmt(v),
      swatch: many ? colours[k]?.fill : undefined,
      active: many && active === k,
    };
  });
  if (many && total) rows.push({ label: 'Total', value: fmt(series.reduce((t, s) => t + (s.values[c] ?? 0), 0)) });
  return [...rows, ...tooltipRows(extras)];
}

const length = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

/**
 * The high-contrast tooltip (principle 29), anchored above a point. Positioned by the caller in px
 * (or any CSS length, e.g. a percentage along a bar) relative to a `position: relative` container.
 */
export const ChartTooltip: FunctionalComponent<{ x: number | string; y: number | string; title: string; rows: readonly TooltipRow[] }> = ({ x, y, title, rows }) => (
  <div class="u-tooltip u-chart-tooltip" style={{ left: length(x), top: length(y) }} role="status">
    <span class="u-chart-tooltip__title">{title}</span>
    {rows.map((r) => (
      <span key={r.label} class="u-chart-tooltip__row" data-active={r.active ? 'true' : undefined}>
        {r.swatch && <i style={{ background: r.swatch }} aria-hidden="true" />}
        <span>{r.label}</span>
        <b class="u-num">{r.value}</b>
      </span>
    ))}
  </div>
);
