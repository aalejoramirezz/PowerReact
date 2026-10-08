import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { scaleBand, scaleLinear } from 'd3-scale';
import { ChartTooltip, GridLines, Legend, ReferenceLine, seriesTooltipRows, type TooltipRow } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue } from '../../../utils/data';
import {
  sameValue,
  type DataPointClickDetail,
  type DataPointValue,
  type ExportDetail,
  type ExportFormat,
  type FocusModeDetail,
  type ThemeName,
  type ViewChangeDetail,
} from '../../../utils/events';
import { formatter, type FormatSpec } from '../../../utils/formats';
import { clipLabel, labelStep } from '../../../utils/layout/scales';
import { niceDomain, seriesLayout, type Segment, type SeriesLayoutMode } from '../../../utils/layout/series';
import type { PaletteKind } from '../../../utils/palette';
import { nextIndex } from '../../../utils/roving';
import {
  emitSeriesClick,
  isDimmed,
  OTHER_ID,
  seriesChartModel,
  seriesInteractive,
  type CategorySort,
  type ChartCategory,
  type ChartSeries,
  type ReferenceLineSpec,
} from '../../../utils/series-chart';
import { ROW_KEY, seriesTable } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const M = { top: 20, bottom: 26, right: 12 };
/** Grouped bars carry direct labels only when there are few of them (otherwise: tooltip and table). */
const MAX_GROUPED_LABELS = 16;
const VALUE_FONT = '600 11px var(--pbi-font-display)';
const PERCENT_TICKS: FormatSpec = { style: 'percent', decimals: 0 };

interface Mark {
  c: number;
  /** Series index, or null for the whole category. */
  s: number | null;
}

/** Path of a bar with only its outer end rounded (r on the top for positive values, the bottom for negative). */
function barPath(x: number, top: number, w: number, h: number, rTop: number, rBottom: number): string {
  const rt = Math.max(0, Math.min(rTop, w / 2, h));
  const rb = Math.max(0, Math.min(rBottom, w / 2, h - rt));
  const b = top + h;
  return [
    `M${x},${top + rt}`,
    rt ? `Q${x},${top} ${x + rt},${top}` : '',
    `H${x + w - rt}`,
    rt ? `Q${x + w},${top} ${x + w},${top + rt}` : '',
    `V${b - rb}`,
    rb ? `Q${x + w},${b} ${x + w - rb},${b}` : '',
    `H${x + rb}`,
    rb ? `Q${x},${b} ${x},${b - rb}` : '',
    'Z',
  ].join('');
}

/**
 * Columns (FT "magnitude", "change over time", "distribution"): vertical bars for periods and ordinal
 * bands, single or by series (grouped, stacked, 100 %), or a histogram (no gaps between bins). Bars
 * start at zero, the grid stays quiet, totals sit on top when they fit, and reference lines mark a
 * target or average. Hover or the arrow keys show a tooltip with every series and the extra
 * `tooltips` measures; a click (Enter / Space) reports the category and, on a segment, its series.
 */
@Component({
  tag: 'udp-pbi-column-chart',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-column-chart.css'],
  shadow: true,
})
export class UdpPbiColumnChart {
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
  /** The selected category (its raw value or id): the others dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click on a category filters, e.g. 'Date'[Year]. */
  @Prop() crossFilterField?: string;
  /** A click emits `dataPointClick` (default: when a field is set). */
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
  /**
   * card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone,
   * to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged.
   */
  @Prop() frame: VisualFrameMode = 'card';
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** Categories in display order (periods, bands, names). */
  @Prop() categories: ChartCategory[] = [];
  /** One series (single columns) or several, each with one value per category. */
  @Prop() series: ChartSeries[] = [];
  /** Column reference of the series dimension: a click on a segment also filters it. */
  @Prop() seriesField?: string;
  /** The selected series (raw value or id): other series dim. */
  @Prop() selectedSeries?: DataPointValue | null;
  /** Several series: side by side, stacked, or stacked to 100 %. */
  @Prop() layout: 'grouped' | 'stacked' | 'percent' = 'stacked';
  /** histogram: bins touch (a distribution, not separate categories). */
  @Prop() variant: 'column' | 'histogram' = 'column';
  /** Nominal series (categorical), ordered grades (sequential) or bad ↔ good (diverging). */
  @Prop() palette: PaletteKind = 'categorical';
  /** none keeps the order received (time, ordinal bands). */
  @Prop() sort: CategorySort = 'none';
  /** Keep the N largest categories; the rest fold into "Other". */
  @Prop() topN?: number;
  @Prop() referenceLines: ReferenceLineSpec[] = [];
  /** auto: totals (or shares, at 100 %) where they fit; none: tooltip and table only. */
  @Prop() labels: 'auto' | 'none' = 'auto';
  /** Header of the category column in the table view and the export. */
  @Prop() categoryLabel = 'Category';
  /** Plot height in px. */
  @Prop() chartHeight = 260;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  @State() active: Mark | null = null;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private sizer = new WidthObserver((w) => {
    if (w > 0 && w !== this.width) this.width = w;
  });

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  private prepared = () => seriesChartModel(this.categories, this.series, { sort: this.sort, topN: this.topN, palette: this.palette });

  private model = () => seriesTable(this.categories, this.series, this.format, { categoryLabel: this.categoryLabel });

  private pick(mark: Mark, categories: ChartCategory[], series: ChartSeries[]): void {
    const category = categories[mark.c];
    if (!category || !seriesInteractive(this)) return;
    emitSeriesClick(this, category, series.length > 1 && mark.s !== null ? series[mark.s] : undefined);
  }

  private onKeyDown(e: KeyboardEvent, categories: ChartCategory[], series: ChartSeries[]): void {
    const active = this.active;
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && active) {
      e.preventDefault();
      this.pick(active, categories, series);
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && series.length > 1) {
      e.preventDefault();
      const s = active?.s ?? (e.key === 'ArrowUp' ? -1 : series.length);
      this.active = { c: active?.c ?? 0, s: Math.max(0, Math.min(series.length - 1, s + (e.key === 'ArrowUp' ? 1 : -1))) };
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return;
    const c = nextIndex(e.key, active?.c ?? null, categories.length);
    if (c === undefined) return;
    e.preventDefault();
    this.active = { c, s: series.length > 1 ? (active?.s ?? null) : 0 };
  }

  private renderChart = () => {
    const { categories, series, colours, hiddenCategories } = this.prepared();
    const mode: SeriesLayoutMode = series.length <= 1 ? 'single' : this.layout;
    const lay = seriesLayout(categories.length, series, { mode });
    const percent = mode === 'percent';
    const fmt = formatter(this.format);
    const pct = formatter(PERCENT_TICKS);
    const tickFmt = percent ? pct : fmt;
    const interactive = seriesInteractive(this);
    const histogram = this.variant === 'histogram' && series.length <= 1;
    const ramp = this.palette !== 'categorical';

    const refs = percent ? [] : this.referenceLines.filter((r) => Number.isFinite(r.value));
    const domain: [number, number] = percent
      ? lay.domain
      : niceDomain(Math.min(lay.domain[0], ...refs.map((r) => r.value)), Math.max(lay.domain[1], ...refs.map((r) => r.value)));
    const height = this.chartHeight;
    const innerH = Math.max(60, height - M.top - M.bottom);
    const y = scaleLinear().domain(domain).range([innerH, 0]);
    const ticks = percent ? [0, 0.25, 0.5, 0.75, 1] : y.ticks(4);
    const left = Math.max(28, Math.round(Math.max(...ticks.map((t) => tickFmt(t).length)) * 6.6) + 12);
    // Reference labels sit in a right margin, clear of the columns (name over value)
    const refRight = refs.length
      ? Math.max(...refs.map((r) => Math.max((r.label ?? '').length, fmt(r.value).length))) * 6.2 + 14
      : 0;
    const innerW = Math.max(60, this.width - left - Math.max(M.right, refRight));

    const x = scaleBand<number>()
      .domain(categories.map((_, i) => i))
      .range([0, innerW])
      .paddingInner(histogram ? 0.04 : 0.3)
      .paddingOuter(histogram ? 0.02 : 0.15);
    const band = x.bandwidth();
    const step = x.step();
    const inner = scaleBand<number>()
      .domain(series.map((_, i) => i))
      .range([0, band])
      .paddingInner(0.12);
    const zero = y(0);

    /** Pixel box of a segment. */
    const box = (g: Segment) => {
      const x0 = (x(g.categoryIndex) ?? 0) + (mode === 'grouped' ? (inner(g.seriesIndex) ?? 0) : 0);
      const w = mode === 'grouped' ? inner.bandwidth() : band;
      const top = y(Math.max(g.start, g.end));
      const bottom = y(Math.min(g.start, g.end));
      return { x: x0, w, top, h: Math.max(0, bottom - top) };
    };

    const selectedIndex = categories.findIndex((c) => c.id !== OTHER_ID && sameValue(clickValue(c), this.selectedValue));
    const every = labelStep(categories.length, innerW);
    const maxChars = Math.max(3, Math.floor((step * every) / 6.4));
    const active = this.active && this.active.c < categories.length ? this.active : null;
    const fill = (s: number) => (series.length <= 1 && !ramp ? 'url(#cc-fill)' : (colours[s]?.fill ?? 'var(--pbi-primary)'));
    const testId = (c: ChartCategory, s?: ChartSeries) =>
      this.testIdPrefix ? `${this.testIdPrefix}-mark-${c.id}${s && series.length > 1 ? `-${s.id}` : ''}` : undefined;

    // Tooltip: every series of the active category, the total, then the extra measures
    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active) {
      const category = categories[active.c] as ChartCategory;
      const segs = lay.segments[active.c] ?? [];
      const rows = seriesTooltipRows(series, colours, active.c, {
        active: active.s,
        fmt,
        share: percent ? (k) => pct(segs.find((g) => g.seriesIndex === k)?.share ?? 0) : undefined,
        total: mode !== 'grouped',
        extras: category.tooltips,
      });
      const tops = segs.filter((g) => g.end !== g.start).map((g) => box(g).top);
      const markTop = active.s !== null && segs[active.s] && mode !== 'single' ? box(segs[active.s] as Segment).top : Math.min(zero, ...tops);
      const cx = left + (x(active.c) ?? 0) + band / 2;
      tooltip = { x: Math.min(Math.max(cx, left + 70), left + innerW - 40), y: M.top + markTop, title: category.label, rows };
    }

    const legend =
      series.length > 1 ? <Legend items={series.map((s, k) => ({ label: s.label, fill: colours[k]?.fill ?? 'var(--pbi-primary)' }))} /> : null;

    return (
      <div class="cc">
        {legend}
        <div class="cc-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg
            class="u-chart-svg"
            width={this.width}
            height={height}
            role="img"
            aria-label={chartLabel(this)}
            tabindex={0}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, categories, series)}
          >
            <defs>
              <linearGradient id="cc-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" style={{ stopColor: 'var(--pbi-bar-1)' }} />
                <stop offset="0.6" style={{ stopColor: 'var(--pbi-bar-2)' }} />
                <stop offset="1" style={{ stopColor: 'var(--pbi-bar-3)' }} />
              </linearGradient>
            </defs>
            <g transform={`translate(${left},${M.top})`}>
              {/* Bands behind the marks: the selected category, then the one under the pointer / keyboard */}
              {selectedIndex >= 0 && (
                <rect x={(x(selectedIndex) ?? 0) - (step - band) / 2} y={0} width={step} height={innerH} rx={6} style={{ fill: 'var(--pbi-row-selected)' }} />
              )}
              {active && active.c !== selectedIndex && (
                <rect x={(x(active.c) ?? 0) - (step - band) / 2} y={0} width={step} height={innerH} rx={6} style={{ fill: 'var(--pbi-row-hover)' }} />
              )}

              <GridLines orientation="rows" ticks={ticks} pos={y} from={0} to={innerW} format={tickFmt} />

              {/* Pointer capture per category (easier to hit than a thin column) */}
              {categories.map((c, i) => (
                <rect
                  key={`h${c.id}`}
                  class="cc-capture"
                  data-interactive={String(interactive && c.id !== OTHER_ID)}
                  x={(x(i) ?? 0) - (step - band) / 2}
                  y={0}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => (this.active = { c: i, s: series.length > 1 ? null : 0 })}
                  onClick={() => this.pick({ c: i, s: null }, categories, series)}
                />
              ))}

              {lay.segments.map((segs, i) => {
                const category = categories[i] as ChartCategory;
                const visible = segs.filter((g) => g.end !== g.start);
                const top = Math.min(zero, ...visible.map((g) => box(g).top));
                const bottom = Math.max(zero, ...visible.map((g) => box(g).top + box(g).h));
                const origin = bottom > top ? ((zero - top) / (bottom - top)) * 100 : 100;
                const outerPos = visible.filter((g) => g.end > 0).sort((a, b) => b.end - a.end)[0];
                const outerNeg = visible.filter((g) => g.start < 0).sort((a, b) => a.start - b.start)[0];
                return (
                  <g
                    key={`c${category.id}`}
                    class="cc-col"
                    style={{ transformOrigin: `50% ${origin}%`, animationDelay: `${300 + Math.min(i, 14) * 45}ms` }}
                  >
                    {visible.map((g) => {
                      const b = box(g);
                      const s = series[g.seriesIndex];
                      const separate = mode === 'grouped' || mode === 'single';
                      const r = histogram ? 2 : 4;
                      const rTop = separate ? (g.value >= 0 ? r : 0) : g === outerPos ? r : 0;
                      const rBottom = separate ? (g.value < 0 ? r : 0) : g === outerNeg ? r : 0;
                      const isActive = active?.c === i && (series.length <= 1 || active.s === g.seriesIndex);
                      return (
                        <path
                          key={`s${s?.id ?? g.seriesIndex}`}
                          class={{ 'u-mark': true, 'u-mark-active': isActive }}
                          d={barPath(b.x, b.top, b.w, b.h, rTop, rBottom)}
                          data-dimmed={String(isDimmed(category, s, this.selectedValue, this.selectedSeries))}
                          data-interactive={String(interactive)}
                          data-testid={testId(category, s)}
                          style={{ fill: fill(g.seriesIndex), stroke: mode === 'stacked' || mode === 'percent' ? 'var(--pbi-card-solid)' : undefined }}
                          onMouseEnter={() => (this.active = { c: i, s: g.seriesIndex })}
                          onClick={() => this.pick({ c: i, s: g.seriesIndex }, categories, series)}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Direct labels where they fit: totals on top, shares inside 100 % segments (ramps only: their text tokens are contrast-checked) */}
              {this.labels === 'auto' && (
                <g class="cc-values" aria-hidden="true">
                  {lay.segments.map((segs, i) => {
                    const cx = (x(i) ?? 0) + band / 2;
                    if (percent) {
                      if (!ramp || band < 30) return null;
                      return segs
                        .filter((g) => box(g).h >= 16 && g.share >= 0.08)
                        .map((g) => {
                          const b = box(g);
                          return (
                            <text
                              key={`p${i}-${g.seriesIndex}`}
                              x={cx}
                              y={b.top + b.h / 2 + 4}
                              text-anchor="middle"
                              style={{ font: VALUE_FONT, fill: colours[g.seriesIndex]?.text ?? 'var(--pbi-title)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {pct(g.share)}
                            </text>
                          );
                        });
                    }
                    if (mode === 'grouped') {
                      if (inner.bandwidth() < 22 || categories.length * series.length > MAX_GROUPED_LABELS) return null;
                      return segs.map((g) => {
                        const b = box(g);
                        const text = fmt(g.value);
                        if (text.length * 6.2 > inner.bandwidth() + 8) return null;
                        return (
                          <text
                            key={`g${i}-${g.seriesIndex}`}
                            x={b.x + b.w / 2}
                            y={g.value >= 0 ? b.top - 5 : b.top + b.h + 12}
                            text-anchor="middle"
                            style={{ font: VALUE_FONT, fill: 'var(--pbi-text-soft)', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {text}
                          </text>
                        );
                      });
                    }
                    const net = segs.reduce((t, g) => t + g.value, 0);
                    const text = fmt(net);
                    if (band < 18 || text.length * 6.2 > step - 2) return null;
                    const tops = segs.filter((g) => g.end !== g.start).map((g) => box(g));
                    const yTop = Math.min(zero, ...tops.map((b) => b.top));
                    const yBottom = Math.max(zero, ...tops.map((b) => b.top + b.h));
                    return (
                      <text
                        key={`t${i}`}
                        x={cx}
                        y={net >= 0 ? yTop - 6 : yBottom + 13}
                        text-anchor="middle"
                        style={{ font: VALUE_FONT, fill: 'var(--pbi-title)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {text}
                      </text>
                    );
                  })}
                </g>
              )}

              {refs.map((r) => (
                <g key={`r${r.value}`}>
                  <ReferenceLine
                    orientation="horizontal"
                    at={y(r.value)}
                    from={0}
                    to={innerW}
                    label={r.label ?? fmt(r.value)}
                    detail={r.label ? fmt(r.value) : undefined}
                    labelAt="outside"
                  />
                </g>
              ))}

              {/* Category labels, thinned so they never collide; the selected and active ones always show */}
              <g aria-hidden="true">
                {categories.map((c, i) => {
                  const emphasised = i === selectedIndex || i === active?.c;
                  if (!(i % every === 0 || emphasised)) return null;
                  const text = clipLabel(c.label, emphasised ? Math.max(maxChars, 14) : maxChars);
                  return (
                    <text
                      key={`l${c.id}`}
                      x={(x(i) ?? 0) + band / 2}
                      y={innerH + 17}
                      text-anchor="middle"
                      style={{ font: emphasised ? '600 11px var(--pbi-font-body)' : '500 11px var(--pbi-font-body)', fill: emphasised ? 'var(--pbi-title)' : 'var(--pbi-axis)' }}
                    >
                      {text}
                      {text !== c.label && <title>{c.label}</title>}
                    </text>
                  );
                })}
              </g>
            </g>
          </svg>
          {tooltip && <ChartTooltip x={tooltip.x} y={tooltip.y} title={tooltip.title} rows={tooltip.rows} />}
        </div>
        {hiddenCategories > 0 && <p class="u-note">{`Top ${categories.length - 1} of ${categories.length - 1 + hiddenCategories} · the rest in "Other"`}</p>}
      </div>
    );
  };

  private renderTable = () => {
    const m = this.model();
    return (
      <udp-pbi-data-table
        frame="none"
        visualId={this.visualId}
        label={`${chartLabel(this)} (table)`}
        columns={m.columns}
        rows={m.rows}
        rowKey={ROW_KEY}
        selectedValue={this.selectedValue}
        crossFilterField={this.crossFilterField}
        interactive={Boolean(this.crossFilterField) && (this.interactive ?? true)}
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
