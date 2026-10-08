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
import { dotDomain, dotPlotRows, moveGood, spreadLabels, type DotPlotItem, type DotPlotSort } from '../../../utils/layout/dotplot';
import { clipLabel } from '../../../utils/layout/scales';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const ROW_H = 30;
const M = { top: 18, bottom: 26 };
const PERCENT: FormatSpec = { style: 'percent', decimals: 1 };

/** Signed change text: +3, −12. */
const signed = (fmt: (v: number) => string, v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : fmt(0));
const tone = (good: boolean | null) => (good === null ? 'var(--pbi-secondary)' : good ? 'var(--pbi-ok)' : 'var(--pbi-bad)');

/**
 * Dot plot (FT "change" and "ranking"): two values per category — before → after, plan → actual,
 * a week ago → now. `dumbbell` draws both on one axis joined by a line; `slope` joins them across two
 * vertical axes, labels spread so they never overlap. The connector is coloured by business meaning
 * (`goodWhen`), the dots stay neutral (hollow first value, solid second). No zero baseline: dot plots
 * compare positions, not lengths. Hover or ↑ ↓ show the tooltip; a click (Enter / Space) reports
 * the category.
 */
@Component({
  tag: 'udp-pbi-dot-plot',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-dot-plot.css'],
  shadow: true,
})
export class UdpPbiDotPlot {
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

  @Prop() items: DotPlotItem[] = [];
  @Prop() variant: 'dumbbell' | 'slope' = 'dumbbell';
  /** What the two values are (legend, tooltip, table, slope axes). */
  @Prop() fromLabel = 'Before';
  @Prop() toLabel = 'After';
  /** Which way a move is favourable (colours the connector). */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** none keeps the order received; to ranks by the second value; change by the size of the move. */
  @Prop() sort: DotPlotSort = 'none';
  /** Header of the category column in the table view and the export. */
  @Prop() categoryLabel = 'Category';
  /** Slope chart height in px (the dumbbell grows with its rows). */
  @Prop() chartHeight = 320;

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
      { key: 'from', label: this.fromLabel, kind: 'number', format: this.format },
      { key: 'to', label: this.toLabel, kind: 'number', format: this.format },
      { key: 'change', label: 'Change', kind: 'number', format: this.format },
      { key: 'pct', label: 'Change %', kind: 'number', format: PERCENT },
    ],
    rows: dotPlotRows(this.items, this.sort).map((d) => ({
      [ROW_KEY]: clickValue(d),
      category: d.label,
      from: d.from,
      to: d.to,
      change: d.from !== null && d.to !== null ? d.to - d.from : null,
      pct: d.from && d.to !== null ? (d.to - d.from) / Math.abs(d.from) : null,
    })),
  });

  private onKeyDown(e: KeyboardEvent, rows: DotPlotItem[]): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const d = rows[this.active];
      if (d && isInteractive(this)) emitClick(this, d);
      return;
    }
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, rows.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private tooltip(d: DotPlotItem, fmt: (v: number) => string): TooltipRow[] {
    const change = d.from !== null && d.to !== null ? d.to - d.from : null;
    return [
      { label: this.fromLabel, value: d.from === null ? '—' : fmt(d.from) },
      { label: this.toLabel, value: d.to === null ? '—' : fmt(d.to) },
      { label: 'Change', value: change === null ? '—' : signed(fmt, change), swatch: tone(moveGood(d, this.goodWhen)) },
      ...tooltipRows(d.tooltips),
    ];
  }

  private renderChart = () => (this.variant === 'slope' ? this.renderSlope() : this.renderDumbbell());

  private svgProps(rows: DotPlotItem[]) {
    return {
      class: 'u-chart-svg',
      role: 'img',
      'aria-label': chartLabel(this),
      tabindex: 0,
      onMouseLeave: () => (this.active = null),
      onBlur: () => (this.active = null),
      onKeyDown: (e: KeyboardEvent) => this.onKeyDown(e, rows),
    };
  }

  private legend() {
    return (
      <ul class="u-legend dp-legend" aria-label="Legend">
        <li>
          <i class="dp-swatch dp-swatch--from" aria-hidden="true" />
          {this.fromLabel}
        </li>
        <li>
          <i class="dp-swatch dp-swatch--to" aria-hidden="true" />
          {this.toLabel}
        </li>
      </ul>
    );
  }

  private renderDumbbell() {
    const rows = dotPlotRows(this.items, this.sort);
    const fmt = formatter(this.format);
    const labelW = Math.min(this.width * 0.34, Math.max(...rows.map((d) => d.label.length)) * 6.6 + 14);
    const left = Math.round(labelW);
    // Both values at the row's end ("85 → 49"): the label never sits beside the wrong dot
    const valueText = (d: DotPlotItem) => (d.from !== null && d.to !== null ? `${fmt(d.from)} → ${fmt(d.to)}` : fmt(d.to ?? 0));
    const valueW = Math.max(44, ...rows.map((d) => valueText(d).length * 6.4 + 16));
    const innerW = Math.max(80, this.width - left - valueW);
    const height = M.top + M.bottom + rows.length * ROW_H;
    const x = scaleLinear().domain(dotDomain(rows)).range([0, innerW]).nice(4);
    const ticks = x.ticks(Math.max(2, Math.min(6, Math.floor(innerW / 90))));
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const active = this.active !== null && this.active < rows.length ? this.active : null;
    const at = active !== null ? (rows[active] as DotPlotItem) : undefined;
    const p = this.testIdPrefix;

    return (
      <div class="dp">
        {this.legend()}
        <div class="dp-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg width={this.width} height={height} {...this.svgProps(rows)}>
            <g transform={`translate(${left},${M.top})`}>
              <GridLines orientation="columns" ticks={ticks} pos={x} from={-6} to={rows.length * ROW_H} format={fmt} />
              {rows.map((d, i) => {
                const cy = i * ROW_H + ROW_H / 2;
                const good = moveGood(d, this.goodWhen);
                const dimmed = hasSelection && !sameValue(clickValue(d), this.selectedValue);
                return (
                  <g
                    key={d.id}
                    class={{ 'u-mark': true, 'dp-row': true }}
                    data-dimmed={String(dimmed)}
                    data-interactive={String(interactive)}
                    data-testid={p ? `${p}-row-${d.id}` : undefined}
                    onMouseEnter={() => (this.active = i)}
                    onClick={() => interactive && emitClick(this, d)}
                  >
                    <rect x={-left + 4} y={i * ROW_H} width={innerW + left} height={ROW_H} rx={6} class={{ 'dp-band': true, 'dp-band--active': active === i }} />
                    <text x={-10} y={cy + 4} text-anchor="end" class={{ 'dp-label': true, 'dp-label--active': active === i }}>
                      {clipLabel(d.label, Math.floor(labelW / 6.6))}
                    </text>
                    {d.from !== null && d.to !== null && <line x1={x(d.from)} x2={x(d.to)} y1={cy} y2={cy} class="dp-link" style={{ stroke: tone(good) }} />}
                    {d.from !== null && <circle cx={x(d.from)} cy={cy} r={5} class="dp-dot dp-dot--from" />}
                    {d.to !== null && <circle cx={x(d.to)} cy={cy} r={6} class={{ 'dp-dot': true, 'dp-dot--to': true, 'u-mark-active': active === i }} />}
                    {d.to !== null && (
                      <text x={x(Math.max(d.to, d.from ?? d.to)) + 10} y={cy + 4} class="dp-value">
                        {d.from !== null && <tspan class="dp-value__from">{`${fmt(d.from)} → `}</tspan>}
                        {fmt(d.to)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          {at && active !== null && (
            <ChartTooltip x={Math.min(Math.max(left + x(at.to ?? at.from ?? 0), 80), this.width - 80)} y={M.top + active * ROW_H + 6} title={at.label} rows={this.tooltip(at, fmt)} />
          )}
        </div>
      </div>
    );
  }

  private renderSlope() {
    const rows = dotPlotRows(this.items, this.sort);
    const fmt = formatter(this.format);
    const height = this.chartHeight;
    const innerH = Math.max(80, height - M.top - M.bottom);
    const labelW = Math.min(this.width * 0.3, Math.max(...rows.map((d) => d.label.length)) * 6.6 + 60);
    const x0 = 56;
    const x1 = Math.max(x0 + 80, this.width - labelW);
    const y = scaleLinear().domain(dotDomain(rows)).range([innerH, 0]);
    const leftY = spreadLabels(rows.map((d) => (d.from === null ? -1000 : y(d.from))), 13);
    const rightY = spreadLabels(rows.map((d) => (d.to === null ? -1000 : y(d.to))), 13);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const active = this.active !== null && this.active < rows.length ? this.active : null;
    const at = active !== null ? (rows[active] as DotPlotItem) : undefined;
    const p = this.testIdPrefix;

    return (
      <div class="dp">
        <div class="dp-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg width={this.width} height={height} {...this.svgProps(rows)}>
            <g transform={`translate(0,${M.top})`}>
              <line x1={x0} x2={x0} y1={0} y2={innerH} class="dp-axis" />
              <line x1={x1} x2={x1} y1={0} y2={innerH} class="dp-axis" />
              <text x={x0} y={innerH + 18} text-anchor="middle" class="dp-caption">
                {this.fromLabel}
              </text>
              <text x={x1} y={innerH + 18} text-anchor="middle" class="dp-caption">
                {this.toLabel}
              </text>
              {rows.map((d, i) => {
                if (d.from === null || d.to === null) return null;
                const good = moveGood(d, this.goodWhen);
                const dimmed = (hasSelection && !sameValue(clickValue(d), this.selectedValue)) || (active !== null && active !== i);
                return (
                  <g
                    key={d.id}
                    class={{ 'u-mark': true, 'dp-row': true }}
                    data-dimmed={String(dimmed)}
                    data-interactive={String(interactive)}
                    data-testid={p ? `${p}-row-${d.id}` : undefined}
                    onMouseEnter={() => (this.active = i)}
                    onClick={() => interactive && emitClick(this, d)}
                  >
                    <line x1={x0} x2={x1} y1={y(d.from)} y2={y(d.to)} class="dp-slope-hit" />
                    <line x1={x0} x2={x1} y1={y(d.from)} y2={y(d.to)} class="dp-slope" style={{ stroke: tone(good) }} />
                    <circle cx={x0} cy={y(d.from)} r={4.5} class="dp-dot dp-dot--from" />
                    <circle cx={x1} cy={y(d.to)} r={5} class={{ 'dp-dot': true, 'dp-dot--to': true, 'u-mark-active': active === i }} />
                    <text x={x0 - 10} y={(leftY[i] ?? 0) + 4} text-anchor="end" class="dp-value">
                      {fmt(d.from)}
                    </text>
                    <text x={x1 + 10} y={(rightY[i] ?? 0) + 4} class={{ 'dp-label': true, 'dp-label--active': active === i }}>
                      <tspan class="dp-value">{fmt(d.to)}</tspan> {clipLabel(d.label, Math.floor((labelW - 60) / 6.6))}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          {at && at.to !== null && <ChartTooltip x={Math.min(x1, this.width - 90)} y={M.top + y(at.to) - 4} title={at.label} rows={this.tooltip(at, fmt)} />}
        </div>
      </div>
    );
  }

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
