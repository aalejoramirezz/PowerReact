import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { scaleLinear } from 'd3-scale';
import { ChartTooltip, GridLines, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive } from '../../../utils/data';
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
import { itemStats, type BoxPlotItem, type BoxStats } from '../../../utils/layout/boxplot';
import { axisDomain } from '../../../utils/layout/scatter';
import { clipLabel } from '../../../utils/layout/scales';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const ROW_H = 36;
const M = { top: 10, bottom: 26 };
const COUNT = new Intl.NumberFormat('en');

/**
 * Box plot (FT "distribution"): how values spread within each category — the box spans the middle
 * half (Q1–Q3) with the median as a strong line, whiskers reach the furthest values within
 * 1.5 × IQR (Tukey) and the values beyond are dots; the mean is an optional diamond. Statistics
 * usually come from the engine (PERCENTILEX.INC); raw values are summarised here. Hover or ↑ ↓ show
 * the five numbers; a click (Enter / Space) reports the category.
 */
@Component({
  tag: 'udp-pbi-boxplot',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-boxplot.css'],
  shadow: true,
})
export class UdpPbiBoxplot {
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
  /** The selected category (raw value or id): the others dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click filters. */
  @Prop() crossFilterField?: string;
  /** A click emits `dataPointClick` (default: when `crossFilterField` is set). */
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

  /** One entry per category: statistics (min, q1, median, q3, max) or raw `values`. */
  @Prop() items: BoxPlotItem[] = [];
  /** Draw the mean as a diamond. */
  @Prop() showMean = true;
  /** Start the axis at zero. */
  @Prop() zero = false;
  /** Header of the category column in the table view and the export. */
  @Prop() categoryLabel = 'Category';

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  @State() active: number | null = null;

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

  private model = (): TableModel => ({
    columns: [
      { key: 'category', label: this.categoryLabel },
      ...(['min', 'q1', 'median', 'q3', 'max', 'mean'] as const).map((k) => ({ key: k, label: k === 'q1' ? 'Q1' : k === 'q3' ? 'Q3' : k[0]?.toUpperCase() + k.slice(1), kind: 'number' as const, format: this.format })),
      { key: 'count', label: 'Count', kind: 'number' },
    ],
    rows: this.items.map((item) => {
      const s = itemStats(item);
      return { [ROW_KEY]: clickValue(item), category: item.label, min: s.min, q1: s.q1, median: s.median, q3: s.q3, max: s.max, mean: s.mean ?? null, count: s.count ?? null };
    }),
  });

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const item = this.items[this.active];
      if (item && isInteractive(this)) emitClick(this, item);
      return;
    }
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, this.items.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const items = this.items;
    const stats: BoxStats[] = items.map(itemStats);
    const fmt = formatter(this.format);
    const all = stats.flatMap((s) => [s.min, s.max, ...(s.outliers ?? [])]);
    const labelW = Math.min(this.width * 0.3, Math.max(...items.map((d) => d.label.length)) * 6.6 + 14);
    const left = Math.round(labelW);
    const innerW = Math.max(80, this.width - left - 20);
    const height = M.top + M.bottom + items.length * ROW_H;
    const x = scaleLinear().domain(axisDomain(all, { zero: this.zero })).range([0, innerW]);
    const ticks = x.ticks(Math.max(2, Math.min(6, Math.floor(innerW / 90))));
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const active = this.active !== null && this.active < items.length ? this.active : null;
    const p = this.testIdPrefix;
    const v = (n: number | null | undefined) => (typeof n === 'number' ? fmt(n) : '—');

    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active !== null) {
      const s = stats[active] as BoxStats;
      const item = items[active] as BoxPlotItem;
      tooltip = {
        x: Math.min(Math.max(left + x(s.median ?? 0), 90), this.width - 90),
        y: M.top + active * ROW_H + 4,
        title: item.label,
        rows: [
          { label: 'Max', value: v(s.max) },
          { label: 'Q3', value: v(s.q3) },
          { label: 'Median', value: v(s.median) },
          { label: 'Q1', value: v(s.q1) },
          { label: 'Min', value: v(s.min) },
          ...(typeof s.mean === 'number' ? [{ label: 'Mean', value: v(s.mean) }] : []),
          ...(typeof s.count === 'number' ? [{ label: 'Count', value: COUNT.format(s.count) }] : []),
          ...((s.outliers?.length ?? 0) > 0 ? [{ label: 'Outliers', value: COUNT.format(s.outliers?.length ?? 0) }] : []),
          ...tooltipRows(item.tooltips),
        ],
      };
    }

    return (
      <div class="bx">
        <div class="bx-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg
            class="u-chart-svg"
            width={this.width}
            height={height}
            role="img"
            aria-label={chartLabel(this)}
            tabindex={0}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}
          >
            <g transform={`translate(${left},${M.top})`}>
              <GridLines orientation="columns" ticks={ticks} pos={x} from={0} to={items.length * ROW_H} format={fmt} />
              {items.map((item, i) => {
                const s = stats[i] as BoxStats;
                const cy = i * ROW_H + ROW_H / 2;
                const dimmed = hasSelection && !sameValue(clickValue(item), this.selectedValue);
                const ok = s.q1 !== null && s.q3 !== null && s.median !== null;
                return (
                  <g
                    key={item.id}
                    class={{ 'u-mark': true, 'bx-row': true }}
                    data-dimmed={String(dimmed)}
                    data-interactive={String(interactive)}
                    data-testid={p ? `${p}-row-${item.id}` : undefined}
                    onMouseEnter={() => (this.active = i)}
                    onClick={() => interactive && emitClick(this, item)}
                  >
                    <rect x={-left + 4} y={i * ROW_H} width={innerW + left} height={ROW_H} rx={6} class={{ 'bx-band': true, 'bx-band--active': active === i }} />
                    <text x={-10} y={cy + 4} text-anchor="end" class={{ 'bx-label': true, 'bx-label--active': active === i }}>
                      {clipLabel(item.label, Math.floor(labelW / 6.6))}
                    </text>
                    {ok && s.min !== null && s.max !== null && (
                      <g class="bx-whisker">
                        <line x1={x(s.min)} x2={x(s.q1 as number)} y1={cy} y2={cy} />
                        <line x1={x(s.q3 as number)} x2={x(s.max)} y1={cy} y2={cy} />
                        <line x1={x(s.min)} x2={x(s.min)} y1={cy - 5} y2={cy + 5} />
                        <line x1={x(s.max)} x2={x(s.max)} y1={cy - 5} y2={cy + 5} />
                      </g>
                    )}
                    {ok && (
                      <rect
                        x={x(s.q1 as number)}
                        y={cy - 9}
                        width={Math.max(2, x(s.q3 as number) - x(s.q1 as number))}
                        height={18}
                        rx={3}
                        class={{ 'bx-box': true, 'u-mark-active': active === i }}
                      />
                    )}
                    {ok && <line x1={x(s.median as number)} x2={x(s.median as number)} y1={cy - 9} y2={cy + 9} class="bx-median" />}
                    {this.showMean && typeof s.mean === 'number' && (
                      <path d={`M${x(s.mean)},${cy - 4} l4,4 l-4,4 l-4,-4 Z`} class="bx-mean" />
                    )}
                    {(s.outliers ?? []).slice(0, 200).map((o, k) => (
                      <circle key={`o${k}`} cx={x(o)} cy={cy} r={2.5} class="bx-outlier" />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>
          {tooltip && <ChartTooltip x={tooltip.x} y={tooltip.y} title={tooltip.title} rows={tooltip.rows} />}
        </div>
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
        interactive={isInteractive(this)}
      />
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.items.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
