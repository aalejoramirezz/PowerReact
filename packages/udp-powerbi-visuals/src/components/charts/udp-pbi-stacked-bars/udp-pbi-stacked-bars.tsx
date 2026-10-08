import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { ChartTooltip, Legend, seriesTooltipRows } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel } from '../../../utils/data';
import type {
  DataPointClickDetail,
  DataPointValue,
  ExportDetail,
  ExportFormat,
  FocusModeDetail,
  ThemeName,
  ViewChangeDetail,
} from '../../../utils/events';
import { formatter, type FormatSpec } from '../../../utils/formats';
import { niceDomain, seriesLayout, type Segment } from '../../../utils/layout/series';
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
} from '../../../utils/series-chart';
import { ROW_KEY, seriesTable } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const PERCENT: FormatSpec = { style: 'percent', decimals: 0 };

interface Mark {
  c: number;
  s: number | null;
}

/**
 * Horizontal bars split by series (FT "part-to-whole" and "deviation"): stacked, 100 % (spine),
 * diverging around a neutral middle (Likert: condition grades, satisfaction) or grouped side by
 * side. For categories with long names. Segments keep one colour per series (a palette by meaning:
 * nominal, ordered, bad ↔ good) with a legend near the title; shares sit inside ramp segments when
 * they fit. Hover or the arrow keys (↑ ↓ categories, ← → segments) show the tooltip; a click
 * reports the category and the segment's series.
 */
@Component({
  tag: 'udp-pbi-stacked-bars',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-stacked-bars.css'],
  shadow: true,
})
export class UdpPbiStackedBars {
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
  /** Column reference a click on a category filters. */
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

  /** One row per category, in display order (or ranked with `sort`). */
  @Prop() categories: ChartCategory[] = [];
  /** The parts, each with one value per category; their order is the stacking order. */
  @Prop() series: ChartSeries[] = [];
  /** Column reference of the series dimension: a click on a segment also filters it. */
  @Prop() seriesField?: string;
  /** The selected series (raw value or id): other series dim. */
  @Prop() selectedSeries?: DataPointValue | null;
  /** stacked (magnitude), percent (each row 100 %), diverging (Likert, around 0), grouped (side by side). */
  @Prop() layout: 'stacked' | 'percent' | 'diverging' | 'grouped' = 'stacked';
  /** Nominal series (categorical), ordered grades (sequential) or bad ↔ good (diverging). */
  @Prop() palette: PaletteKind = 'categorical';
  /** diverging: series (ids) drawn left of the axis, e.g. Poor, Very poor. */
  @Prop() negativeSeries: string[] = [];
  /** diverging: series (ids) split across the axis, e.g. Fair. */
  @Prop() neutralSeries: string[] = [];
  /** none keeps the order received; desc / asc rank rows by total. */
  @Prop() sort: CategorySort = 'none';
  /** Keep the N largest categories; the rest fold into "Other". */
  @Prop() topN?: number;
  /** auto: totals and, on ramp palettes, shares inside segments where they fit; none: tooltip and table only. */
  @Prop() labels: 'auto' | 'none' = 'auto';
  /** Header of the category column in the table view and the export. */
  @Prop() categoryLabel = 'Category';

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

  /** ↑ ↓ move between rows, ← → between the row's segments in the order they are drawn. */
  private onKeyDown(e: KeyboardEvent, categories: ChartCategory[], series: ChartSeries[], segments: Segment[][]): void {
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const c = active?.c ?? 0;
      const drawn = (segments[c] ?? []).filter((g) => g.end !== g.start).sort((a, b) => a.start - b.start || a.seriesIndex - b.seriesIndex);
      if (!drawn.length) return;
      e.preventDefault();
      const at = drawn.findIndex((g) => g.seriesIndex === active?.s);
      const next = at < 0 ? (e.key === 'ArrowRight' ? 0 : drawn.length - 1) : Math.max(0, Math.min(drawn.length - 1, at + (e.key === 'ArrowRight' ? 1 : -1)));
      this.active = { c, s: drawn[next]?.seriesIndex ?? null };
      return;
    }
    const keyMap: Record<string, string> = { ArrowUp: 'ArrowLeft', ArrowDown: 'ArrowRight', Home: 'Home', End: 'End' };
    const mapped = keyMap[e.key];
    if (!mapped) return;
    const c = nextIndex(mapped, active?.c ?? null, categories.length);
    if (c === undefined) return;
    e.preventDefault();
    this.active = { c, s: active?.s ?? (series.length > 1 ? null : 0) };
  }

  private renderChart = () => {
    const { categories, series, colours, hiddenCategories } = this.prepared();
    const many = series.length > 1;
    const mode = many ? this.layout : 'stacked';
    const lay = seriesLayout(categories.length, series, { mode, negativeSeries: this.negativeSeries, neutralSeries: this.neutralSeries });
    const fmt = formatter(this.format);
    const pct = formatter(PERCENT);
    const interactive = seriesInteractive(this);
    const ramp = this.palette !== 'categorical';
    const shares = mode === 'percent' || mode === 'diverging';
    const [lo, hi] = mode === 'stacked' || mode === 'grouped' ? niceDomain(lay.domain[0], lay.domain[1]) : lay.domain;
    const span = hi - lo || 1;
    const at = (v: number) => ((v - lo) / span) * 100;
    const zero = at(0);
    // Track width estimate (the label column takes ~28 %, or sits above the bar on narrow cards)
    const narrow = this.width < 416;
    const trackPx = Math.max(80, (narrow ? this.width : this.width * 0.72) - (mode === 'diverging' ? 112 : 72));
    const inside = this.labels === 'auto' && ramp && mode !== 'grouped';
    const active = this.active && this.active.c < categories.length ? this.active : null;
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const p = this.testIdPrefix;

    return (
      <div class="sb" data-layout={mode} ref={this.sizer.observe}>
        {many && <Legend items={series.map((s, k) => ({ label: s.label, fill: colours[k]?.fill ?? 'var(--pbi-primary)' }))} />}
        <div
          class="sb-list u-chart-svg"
          role="img"
          aria-label={chartLabel(this)}
          tabindex={0}
          onMouseLeave={() => (this.active = null)}
          onBlur={() => (this.active = null)}
          onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, categories, series, lay.segments)}
        >
          {categories.map((category, c) => {
            const segs = lay.segments[c] ?? [];
            const drawn = segs.filter((g) => g.end !== g.start);
            const first = [...drawn].sort((a, b) => a.start - b.start)[0];
            const last = [...drawn].sort((a, b) => b.end - a.end)[0];
            const negShare = segs.filter((g) => g.end <= 0 && g.start < 0).reduce((t, g) => t + (g.end - g.start), 0);
            const posShare = segs.filter((g) => g.start >= 0 && g.end > 0).reduce((t, g) => t + (g.end - g.start), 0);
            const net = segs.reduce((t, g) => t + g.value, 0);
            const rowDimmed = hasSelection && isDimmed(category, undefined, this.selectedValue, null);
            const tipFor = active?.c === c ? active : null;
            const tipSeg = tipFor && tipFor.s !== null ? segs.find((g) => g.seriesIndex === tipFor.s) : undefined;
            const tipX = tipSeg ? at((tipSeg.start + tipSeg.end) / 2) : at((Math.min(...drawn.map((g) => g.start), 0) + Math.max(...drawn.map((g) => g.end), 0)) / 2);
            return (
              <div
                key={category.id}
                class="sb-row u-row u-row-enter"
                style={{ '--k': String(c) }}
                data-dimmed={String(rowDimmed)}
                data-active={String(active?.c === c)}
                data-testid={p ? `${p}-row-${category.id}` : undefined}
                onMouseEnter={() => (this.active = { c, s: many ? null : 0 })}
                onClick={() => this.pick({ c, s: null }, categories, series)}
                data-interactive={String(interactive && category.id !== OTHER_ID)}
              >
                <span class="u-bar-label sb-label" title={category.label}>
                  {category.label}
                </span>
                <span class="sb-track-wrap">
                  <span
                    class="sb-track"
                    data-mode={mode}
                    data-axis={String(zero > 0.5)}
                    style={{ '--zero': `${zero}%`, '--n': String(series.length) }}
                  >
                    <span class="sb-bars" style={{ transformOrigin: `${zero}% 50%` }}>
                    {drawn.map((g) => {
                      const s = series[g.seriesIndex];
                      const colour = colours[g.seriesIndex];
                      const left = at(Math.min(g.start, g.end));
                      const width = at(Math.max(g.start, g.end)) - left;
                      const px = (width / 100) * trackPx;
                      const text = shares ? pct(g.share) : fmt(g.value);
                      const showText = inside && px >= Math.max(30, text.length * 6.6 + 8);
                      const isActive = active?.c === c && active.s === g.seriesIndex && many;
                      return (
                        <span
                          key={s?.id ?? String(g.seriesIndex)}
                          class={{ 'sb-seg': true, 'u-mark': true, 'sb-seg--active': isActive }}
                          data-first={String(g === first)}
                          data-last={String(g === last)}
                          data-dimmed={String(isDimmed(category, s, this.selectedValue, this.selectedSeries))}
                          data-interactive={String(interactive)}
                          data-testid={p ? `${p}-mark-${category.id}${many && s ? `-${s.id}` : ''}` : undefined}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            ...(mode === 'grouped' ? { top: `${g.seriesIndex * 9}px` } : {}),
                            background: many ? (colour?.fill ?? 'var(--pbi-primary)') : undefined,
                            color: colour?.text,
                          }}
                          onMouseEnter={(e: MouseEvent) => {
                            e.stopPropagation();
                            this.active = { c, s: g.seriesIndex };
                          }}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            this.pick({ c, s: g.seriesIndex }, categories, series);
                          }}
                        >
                          {showText ? text : null}
                        </span>
                      );
                    })}
                    </span>
                  </span>
                  {/* Likert: the unfavourable and favourable shares at the ends of the bar (neutral excluded) */}
                  {mode === 'diverging' && this.labels === 'auto' && drawn.length > 0 && [
                    <span key="neg" class="sb-end sb-end--neg u-num" style={{ right: `${100 - at(first?.start ?? 0)}%` }}>
                      {pct(negShare)}
                    </span>,
                    <span key="pos" class="sb-end sb-end--pos u-num" style={{ left: `${at(last?.end ?? 0)}%` }}>
                      {pct(posShare)}
                    </span>,
                  ]}
                  {tipFor && (
                    <ChartTooltip
                      x={`${Math.min(Math.max(tipX, 12), 88)}%`}
                      y={0}
                      title={category.label}
                      rows={seriesTooltipRows(series, colours, c, {
                        active: tipFor.s,
                        fmt,
                        share: shares ? (k) => pct(segs.find((g) => g.seriesIndex === k)?.share ?? 0) : undefined,
                        total: mode !== 'grouped',
                        extras: category.tooltips,
                      })}
                    />
                  )}
                </span>
                {mode === 'diverging' || mode === 'grouped' ? null : <span class="u-bar-value">{this.labels === 'auto' ? fmt(net) : ''}</span>}
              </div>
            );
          })}
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
