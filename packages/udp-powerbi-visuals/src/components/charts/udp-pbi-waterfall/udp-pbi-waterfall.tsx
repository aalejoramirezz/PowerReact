import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { scaleBand, scaleLinear } from 'd3-scale';
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
import { clipLabel, labelStep } from '../../../utils/layout/scales';
import { waterfallLayout, type WaterfallBar, type WaterfallStep } from '../../../utils/layout/waterfall';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const M = { top: 22, bottom: 26, right: 12 };
const VALUE_FONT = '600 11px var(--pbi-font-display)';
const KIND_LABEL = { start: 'Level', subtotal: 'Subtotal', end: 'Level', delta: 'Movement' } as const;

/** Signed movement text: +5, −4 (a true minus sign). */
const signed = (fmt: (v: number) => string, v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : fmt(0));

/**
 * Waterfall (IBCS bridge; FT "flow"): how a level becomes another — the opening level, the
 * movements and the closing level (with optional subtotals). Levels are solid in the actual colour
 * from zero; movements float from the running level, coloured by business meaning (`goodWhen`)
 * and labelled with their sign; thin connectors carry the running level from step to step.
 * Vertical by default, horizontal for long step names. Hover or ← → show the tooltip; a click
 * (Enter / Space) reports the step.
 */
@Component({
  tag: 'udp-pbi-waterfall',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/charts.css',
    'udp-pbi-waterfall.css',
  ],
  shadow: true,
})
export class UdpPbiWaterfall {
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
  /** The selected step (raw value or id): the others dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click on a step filters. */
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

  /** The bridge, in order: levels (start, subtotal, end) and movements (delta). */
  @Prop() steps: WaterfallStep[] = [];
  /** Which way a movement is favourable (a backlog is better lower). */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  @Prop() orientation: 'vertical' | 'horizontal' = 'vertical';
  /**
   * zero: bars from zero (the default). auto: the axis starts near the lowest level when movements are
   * small against the levels; the level bars are then cut with a break mark (IBCS scaling).
   */
  @Prop() baseline: 'zero' | 'auto' = 'zero';
  /** auto: values on the bars where they fit; none: tooltip and table only. */
  @Prop() labels: 'auto' | 'none' = 'auto';
  /** Header of the step column in the table view and the export. */
  @Prop() categoryLabel = 'Step';
  /** Plot height in px (vertical). */
  @Prop() chartHeight = 280;

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

  private model = (): TableModel => {
    const { bars } = waterfallLayout(this.steps, { goodWhen: this.goodWhen });
    return {
      columns: [
        { key: 'step', label: this.categoryLabel },
        { key: 'kind', label: 'Kind' },
        { key: 'value', label: 'Value', kind: 'number', format: this.format },
        { key: 'level', label: 'Level after', kind: 'number', format: this.format },
      ],
      rows: bars.map((b) => ({ [ROW_KEY]: clickValue(b.step), step: b.step.label, kind: KIND_LABEL[b.kind], value: b.step.value, level: b.level })),
    };
  };

  private fill(b: WaterfallBar): string {
    if (b.good === null) return 'var(--pbi-ac)';
    return b.good ? 'var(--pbi-ok)' : 'var(--pbi-bad)';
  }

  private onKeyDown(e: KeyboardEvent, steps: WaterfallStep[]): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const step = steps[this.active];
      if (step && isInteractive(this)) emitClick(this, step);
      return;
    }
    const vertical = this.orientation === 'vertical';
    const map: Record<string, string> = vertical ? {} : { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    if (vertical && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    const next = nextIndex(map[e.key] ?? e.key, this.active, steps.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const steps = this.steps;
    const { bars, domain, broken } = waterfallLayout(steps, { goodWhen: this.goodWhen, baseline: this.baseline });
    const fmt = formatter(this.format);
    const vertical = this.orientation === 'vertical';
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const active = this.active !== null && this.active < bars.length ? this.active : null;

    const valueTicks = scaleLinear().domain(domain).ticks(4);
    const tickWidth = Math.max(...valueTicks.map((t) => fmt(t).length)) * 6.6 + 12;
    const labelWidth = vertical ? 0 : Math.min(this.width * 0.36, Math.max(...steps.map((s) => s.label.length)) * 6.6 + 14);
    const rowH = 34;
    const height = vertical ? this.chartHeight : M.top + M.bottom + steps.length * rowH;
    const left = vertical ? Math.max(28, Math.round(tickWidth)) : Math.round(labelWidth);
    const right = vertical ? M.right : 48;
    const innerW = Math.max(60, this.width - left - right);
    const innerH = Math.max(60, height - M.top - M.bottom);

    const value = scaleLinear()
      .domain(domain)
      .range(vertical ? [innerH, 0] : [0, innerW]);
    const band = scaleBand<number>()
      .domain(steps.map((_, i) => i))
      .range(vertical ? [0, innerW] : [0, innerH])
      .paddingInner(vertical ? 0.32 : 0.38)
      .paddingOuter(0.12);
    const bw = band.bandwidth();

    /** A bar's rectangle in plot coordinates. */
    const rect = (b: WaterfallBar, i: number) => {
      const p0 = value(Math.max(domain[0], Math.min(b.from, b.to)));
      const p1 = value(Math.max(b.from, b.to));
      const at = band(i) ?? 0;
      return vertical
        ? { x: at, y: p1, w: bw, h: Math.max(1, p0 - p1) }
        : { x: p0, y: at, w: Math.max(1, p1 - p0), h: bw };
    };
    const every = vertical ? labelStep(steps.length, innerW, 60) : 1;
    const maxChars = vertical ? Math.max(4, Math.floor((band.step() * every) / 6.4)) : Math.floor(labelWidth / 6.6);

    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active !== null) {
      const b = bars[active] as WaterfallBar;
      const r = rect(b, active);
      const rows: TooltipRow[] = [
        { label: KIND_LABEL[b.kind], value: b.kind === 'delta' ? signed(fmt, b.to - b.from) : fmt(b.to) },
        ...(b.kind === 'delta' ? [{ label: 'Level after', value: fmt(b.level) }] : []),
        ...tooltipRows(b.step.tooltips),
      ];
      tooltip = vertical
        ? { x: Math.min(Math.max(left + r.x + r.w / 2, left + 70), left + innerW - 40), y: M.top + r.y, title: b.step.label, rows }
        : { x: Math.min(left + r.x + r.w / 2, left + innerW - 60), y: M.top + r.y, title: b.step.label, rows };
    }

    return (
      <div class="wf" ref={this.sizer.observe}>
        <div class="wf-plot" style={{ height: `${height}px` }}>
          <svg
            class="u-chart-svg"
            width={this.width}
            height={height}
            role="img"
            aria-label={chartLabel(this)}
            tabindex={0}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, steps)}
          >
            <g transform={`translate(${left},${M.top})`}>
              {active !== null && (
                <rect
                  x={vertical ? (band(active) ?? 0) - (band.step() - bw) / 2 : -left + 4}
                  y={vertical ? 0 : (band(active) ?? 0) - (band.step() - bw) / 2}
                  width={vertical ? band.step() : innerW + left - 4}
                  height={vertical ? innerH : band.step()}
                  rx={6}
                  style={{ fill: 'var(--pbi-row-hover)' }}
                />
              )}
              <GridLines orientation={vertical ? 'rows' : 'columns'} ticks={valueTicks} pos={value} from={0} to={vertical ? innerW : innerH} format={fmt} />

              {/* Connectors carry the running level to the next step */}
              <g class="wf-connectors" aria-hidden="true">
                {bars.slice(0, -1).map((b, i) => {
                  const r = rect(b, i);
                  const next = band(i + 1) ?? 0;
                  const at = value(b.level);
                  return vertical ? (
                    <line key={`k${b.step.id}`} x1={r.x + r.w} x2={next} y1={at} y2={at} />
                  ) : (
                    <line key={`k${b.step.id}`} y1={r.y + r.h} y2={next} x1={at} x2={at} />
                  );
                })}
              </g>

              {bars.map((b, i) => {
                const r = rect(b, i);
                const dimmed = hasSelection && !sameValue(clickValue(b.step), this.selectedValue);
                return (
                  <g key={b.step.id} class="wf-bar" style={{ animationDelay: `${300 + Math.min(i, 12) * 60}ms` }}>
                    <rect
                      class={{ 'u-mark': true, 'u-mark-active': active === i }}
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      rx={2}
                      data-kind={b.kind}
                      data-dimmed={String(dimmed)}
                      data-interactive={String(interactive)}
                      data-testid={this.testIdPrefix ? `${this.testIdPrefix}-step-${b.step.id}` : undefined}
                      style={{ fill: this.fill(b) }}
                      onMouseEnter={() => (this.active = i)}
                      onClick={() => interactive && emitClick(this, b.step)}
                    />
                    {/* A level cut by the scaled axis: two slanted strokes near its base */}
                    {broken && b.kind !== 'delta' && (
                      <g class="wf-break" aria-hidden="true">
                        {vertical ? (
                          <path d={`M${r.x - 2},${r.y + r.h - 10} L${r.x + r.w + 2},${r.y + r.h - 16} M${r.x - 2},${r.y + r.h - 4} L${r.x + r.w + 2},${r.y + r.h - 10}`} />
                        ) : (
                          <path d={`M${r.x + 6},${r.y - 2} L${r.x + 12},${r.y + r.h + 2} M${r.x + 12},${r.y - 2} L${r.x + 18},${r.y + r.h + 2}`} />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {this.labels === 'auto' && (
                <g class="wf-values" aria-hidden="true">
                  {bars.map((b, i) => {
                    const r = rect(b, i);
                    const v = b.kind === 'delta' ? b.to - b.from : b.to;
                    const text = b.kind === 'delta' ? signed(fmt, v) : fmt(v);
                    if (vertical && text.length * 6.2 > band.step()) return null;
                    const down = v < 0 && b.kind === 'delta';
                    const style = { font: VALUE_FONT, fill: b.good === null ? 'var(--pbi-title)' : b.good ? 'var(--pbi-ok-text)' : 'var(--pbi-bad-text)', fontVariantNumeric: 'tabular-nums' };
                    return vertical ? (
                      <text key={`v${b.step.id}`} x={r.x + r.w / 2} y={down ? r.y + r.h + 13 : r.y - 6} text-anchor="middle" style={style}>
                        {text}
                      </text>
                    ) : (
                      <text key={`v${b.step.id}`} x={r.x + r.w + 6} y={r.y + r.h / 2 + 4} style={style}>
                        {text}
                      </text>
                    );
                  })}
                </g>
              )}

              {/* Step names: under the columns, or left of the bars */}
              <g aria-hidden="true">
                {steps.map((s, i) => {
                  if (vertical && !(i % every === 0 || i === active)) return null;
                  const text = clipLabel(s.label, maxChars);
                  const at = (band(i) ?? 0) + bw / 2;
                  return (
                    <text
                      key={`l${s.id}`}
                      x={vertical ? at : -10}
                      y={vertical ? innerH + 17 : at + 4}
                      text-anchor={vertical ? 'middle' : 'end'}
                      class="wf-label"
                      data-active={String(i === active)}
                    >
                      {text}
                      {text !== s.label && <title>{s.label}</title>}
                    </text>
                  );
                })}
              </g>
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
        paginated={false}
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
          hasData={this.steps.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
