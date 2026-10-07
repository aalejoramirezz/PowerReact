import { Build, Component, Element, Event, h, Host, Prop, State, Watch, type EventEmitter } from '@stencil/core';
import { scaleLinear, scalePoint } from 'd3-scale';
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import { INITIAL_FRAME, VisualFrame, type FrameState } from '../../functional/frame';
import { chartLabel, isInteractive } from '../../utils/data';
import {
  sameValue,
  type DataPointClickDetail,
  type DataPointValue,
  type ExportDetail,
  type ExportFormat,
  type FocusModeDetail,
  type ThemeName,
  type ViewChangeDetail,
} from '../../utils/events';
import { formatter, type FormatSpec } from '../../utils/formats';
import { nearestIndex, trendDomain, validateTrendSeries, type TrendSeries } from '../../utils/layout/trend';
import { ROW_KEY, trendTable } from '../../utils/table/builders';
import type { TableRow } from '../../utils/table/model';
import { WidthObserver } from '../../utils/width-observer';

const M = { top: 16, bottom: 26, left: 46 };
const LABEL_BLOCK = 30;
const TICK = '500 11px var(--u-font-body)';

/** End-of-line labels; when the two series end close together the lower label moves down to stay readable. */
function directLabelPositions(series: Array<TrendSeries | undefined>, y: (v: number) => number) {
  const lastIndex = (s: TrendSeries) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return i;
    return -1;
  };
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
 * arrow keys move a crosshair with a high-contrast tooltip (principle 29). A click (or Enter) on a
 * period reports it as `dataPointClick`.
 */
@Component({
  tag: 'univerus-trend-chart',
  styleUrls: ['../../styles/motion.css', '../../styles/shadow.css', '../../styles/surfaces.css', 'univerus-trend-chart.css'],
  shadow: true,
})
export class UniverusTrendChart {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the chart; defaults to the heading. */
  @Prop() label?: string;
  /** Curtain: what the chart means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected period (a value of `categories`), marked with a band. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click filters, e.g. 'Date'[Month]. */
  @Prop() crossFilterField?: string;
  /** A click on a period emits `dataPointClick` (default: when `crossFilterField` is set). */
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the visual's table. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() tableToggle = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** X categories in order (months, weeks…). */
  @Prop() categories: string[] = [];
  /** Exactly one primary series and at most one comparison (principle 14). */
  @Prop() series: TrendSeries[] = [];
  /** Plot height in px. */
  @Prop() chartHeight = 260;
  /** Shade the primary series down to zero in its own hue (principle 15). */
  @Prop() area = true;
  /** Label each series at its last point instead of relying on a legend (principle 28). */
  @Prop() directLabels = true;

  @State() frame: FrameState = INITIAL_FRAME;
  @State() width = 640;
  @State() active: number | null = null;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private sizer = new WidthObserver((w) => {
    if (w > 0 && w !== this.width) this.width = w;
  });

  @Watch('series')
  validate(): void {
    const problems = validateTrendSeries(this.series);
    if (Build.isDev && problems.length) console.warn(`[univerus-trend-chart] "${chartLabel(this)}": ${problems.join('; ')}`);
  }

  componentWillLoad(): void {
    this.validate();
  }

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  private model = () => trendTable(this.categories, this.series, this.format);

  private pick(i: number): void {
    const category = this.categories[i];
    if (category === undefined || !isInteractive(this)) return;
    this.dataPointClick.emit({ visualId: this.visualId ?? null, field: this.crossFilterField ?? null, value: category, label: category });
  }

  private renderChart = () => {
    const { categories, series, chartHeight: height, area, directLabels } = this;
    const width = this.width;
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
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
    const step = categories.length > 1 ? innerW / (categories.length - 1) : innerW;

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

    const active = this.active;
    const selected = categories.findIndex((c) => sameValue(c, this.selectedValue));
    const labelEvery = Math.max(1, Math.ceil((categories.length * 44) / innerW));
    const valueAt = (s?: TrendSeries) => (s && active !== null ? (s.values[active] ?? null) : null);
    const tooltipLeft = active !== null ? Math.min(Math.max(M.left + px(active), M.left + 50), M.left + innerW - 50) : 0;
    const tooltipTop = active !== null ? M.top + y(valueAt(primary) ?? hi) : 0;

    return (
      <div class="tc" style={{ height: `${height}px` }} ref={this.sizer.observe}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={chartLabel(this)}
          tabindex={0}
          onMouseLeave={() => (this.active = null)}
          onBlur={() => (this.active = null)}
          onKeyDown={(e: KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
              e.preventDefault();
              this.pick(this.active);
              return;
            }
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const current = this.active ?? categories.length - 1;
            this.active = Math.max(0, Math.min(categories.length - 1, current + (e.key === 'ArrowRight' ? 1 : -1)));
          }}
        >
          <defs>
            <linearGradient id="u-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--u-area)', stopOpacity: 'var(--u-area-opacity)' }} />
              <stop offset="1" style={{ stopColor: 'var(--u-area)', stopOpacity: '0' }} />
            </linearGradient>
          </defs>

          <g transform={`translate(${M.left},${M.top})`}>
            {/* The selected period: a quiet band behind the series */}
            {selected >= 0 && (
              <rect x={px(selected) - step / 2} y={0} width={step} height={innerH} rx={6} style={{ fill: 'var(--u-row-selected)' }} />
            )}
            {/* The grid disappears before the data does (principle 26) */}
            {ticks.map((t) => (
              <g key={`t${t}`}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--u-grid)', strokeDasharray: 'var(--u-grid-dash)' }} />
                <text x={-10} y={y(t) + 4} text-anchor="end" style={{ font: TICK, fill: 'var(--u-axis)' }}>
                  {fmt(t)}
                </text>
              </g>
            ))}
            {categories.map((c, i) =>
              i % labelEvery === 0 || i === categories.length - 1 || i === selected ? (
                <text
                  key={`c${c}`}
                  x={px(i)}
                  y={innerH + 18}
                  text-anchor="middle"
                  style={{ font: i === selected ? '600 11px var(--u-font-body)' : TICK, fill: i === selected ? 'var(--u-title)' : 'var(--u-axis)' }}
                >
                  {c}
                </text>
              ) : null
            )}

            {/* Series draw once, left to right */}
            <g style={{ animation: 'u-wipe 1.6s var(--u-ease) .3s both' }}>
              {area && primary && <path d={shade(primary.values) ?? ''} fill="url(#u-area)" />}
              {comparison && (
                <path
                  d={line(comparison.values) ?? ''}
                  fill="none"
                  style={{ stroke: 'var(--u-secondary)', strokeWidth: '1.8', strokeDasharray: '4 5', strokeLinecap: 'round' }}
                />
              )}
              {primary && (
                <path
                  d={line(primary.values) ?? ''}
                  fill="none"
                  style={{ stroke: 'var(--u-primary)', strokeWidth: '2.6', strokeLinecap: 'round', strokeLinejoin: 'round' }}
                />
              )}
            </g>

            {directLabels &&
              directLabelPositions([primary, comparison], (v) => y(v)).map(({ s, i, v, labelY }) => (
                <g key={`l${s.id}`} style={{ animation: 'u-fade .6s var(--u-ease) 1.6s both' }}>
                  <text x={px(i) + 10} y={labelY - 2} style={{ font: '600 11.5px var(--u-font-body)', fill: s.role === 'primary' ? 'var(--u-title)' : 'var(--u-label)' }}>
                    {s.label}
                  </text>
                  <text
                    x={px(i) + 10}
                    y={labelY + 12}
                    style={{ font: '600 11px var(--u-font-display)', fill: s.role === 'primary' ? 'var(--u-primary)' : 'var(--u-label)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmt(v)}
                  </text>
                </g>
              ))}

            {active !== null && (
              <g pointer-events="none">
                <line x1={px(active)} x2={px(active)} y1={0} y2={innerH} style={{ stroke: 'var(--u-interaction)', strokeOpacity: '0.5', strokeDasharray: '3 4' }} />
                {comparison && valueAt(comparison) !== null && (
                  <circle cx={px(active)} cy={y(valueAt(comparison) ?? 0)} r={4} style={{ fill: 'var(--u-card-solid)', stroke: 'var(--u-secondary)', strokeWidth: '2' }} />
                )}
                {primary && valueAt(primary) !== null && (
                  <circle cx={px(active)} cy={y(valueAt(primary) ?? 0)} r={6} style={{ fill: 'var(--u-card-solid)', stroke: 'var(--u-interaction)', strokeWidth: '3' }} />
                )}
              </g>
            )}

            {/* Pointer capture */}
            <rect
              class="tc-capture"
              data-interactive={String(interactive)}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={(e: MouseEvent) => {
                const box = (e.currentTarget as Element).getBoundingClientRect();
                this.active = nearestIndex(positions, e.clientX - box.left);
              }}
              onClick={(e: MouseEvent) => {
                const box = (e.currentTarget as Element).getBoundingClientRect();
                this.pick(nearestIndex(positions, e.clientX - box.left));
              }}
            />
          </g>
        </svg>

        {active !== null && primary && (
          <div class="u-tooltip" style={{ left: `${tooltipLeft}px`, top: `${tooltipTop - 14}px` }} role="status">
            <span class="tc-tip-cat">{categories[active]}</span>
            <b class="u-num">{valueAt(primary) !== null ? fmt(valueAt(primary) ?? 0) : '—'}</b> <span>{primary.label}</span>
            {comparison && <span class="tc-tip-cmp">{`${comparison.label}: ${valueAt(comparison) !== null ? fmt(valueAt(comparison) ?? 0) : '—'}`}</span>}
          </div>
        )}
      </div>
    );
  };

  private renderTable = () => {
    const m = this.model();
    return (
      <univerus-data-table
        bare
        visualId={this.visualId}
        label={`${chartLabel(this)} (table)`}
        columns={m.columns}
        rows={m.rows}
        rowKey={ROW_KEY}
        selectedValue={this.selectedValue}
        crossFilterField={this.crossFilterField}
        interactive={isInteractive(this)}
      />
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.categories.length > 0 && this.series.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
