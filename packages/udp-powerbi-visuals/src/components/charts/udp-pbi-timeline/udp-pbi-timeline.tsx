import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { scaleTime } from 'd3-scale';
import { ChartTooltip, Legend, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
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
import type { FormatSpec } from '../../../utils/formats';
import { isoDay, parseDay } from '../../../utils/layout/calendar';
import { clipLabel } from '../../../utils/layout/scales';
import { timelineLayout, type TimelineBar, type TimelineTask } from '../../../utils/layout/timeline';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const AXIS_H = 24;
const ROW_H = 30;
const LANE_GAP = 10;
const BAR_H = 10;
const DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const TONES = { ok: 'var(--pbi-ok)', warn: 'var(--pbi-warn)', bad: 'var(--pbi-bad)', accent: 'var(--pbi-interaction)', neutral: 'var(--pbi-primary)' } as const;
type Tone = keyof typeof TONES;

/**
 * Timeline (Priestley / Gantt; FT "change over time"): items with a start and an end — warranties,
 * contracts, projects — on a time axis, grouped in lanes and packed so overlapping items never
 * collide; "today" is a line, so what runs and what ends soon read at once. Each bar is a thin rule
 * coloured by meaning (`tone`: ok / warn / bad), its name above it. Hover or ↑ ↓ (items by start)
 * show the dates; a click (Enter / Space) reports the item.
 */
@Component({
  tag: 'udp-pbi-timeline',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-timeline.css'],
  shadow: true,
})
export class UdpPbiTimeline {
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
  /** Not used for dates; kept for the shared contract (tooltip measures carry their own). */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected item (raw value or id): the others dim. */
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

  @Prop() tasks: TimelineTask[] = [];
  /** The "today" line: an ISO date, `auto` (the current day) or `none`. */
  @Prop() today = 'auto';
  /** Legend text per tone, e.g. { ok: 'Active', warn: 'Ends within 90 days', bad: 'Expired' }. */
  @Prop() toneLabels: Partial<Record<Tone, string>> = {};
  /** Header of the item and lane columns in the table view and the export. */
  @Prop() categoryLabel = 'Item';
  @Prop() laneLabel = 'Lane';

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

  private get todayDate(): Date | null {
    if (this.today === 'none') return null;
    if (this.today === 'auto') return new Date(new Date().setHours(0, 0, 0, 0));
    return parseDay(this.today);
  }

  private model = (): TableModel => {
    const lanes = this.tasks.some((t) => t.lane);
    return {
      columns: [
        { key: 'item', label: this.categoryLabel },
        ...(lanes ? [{ key: 'lane', label: this.laneLabel }] : []),
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
        { key: 'days', label: 'Days', kind: 'number' },
      ],
      rows: this.tasks.map((t) => {
        const s = parseDay(t.start);
        const e = t.end ? parseDay(t.end) : null;
        return {
          [ROW_KEY]: clickValue(t),
          item: t.label,
          ...(lanes ? { lane: t.lane ?? null } : {}),
          start: s ? isoDay(s) : t.start,
          end: e ? isoDay(e) : null,
          days: s && e ? Math.round((e.getTime() - s.getTime()) / 86_400_000) : null,
        };
      }),
    };
  };

  private onKeyDown(e: KeyboardEvent, order: TimelineBar[]): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const bar = order[this.active];
      if (bar && isInteractive(this)) emitClick(this, bar.task);
      return;
    }
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, order.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const today = this.todayDate;
    const { lanes, domain } = timelineLayout(this.tasks, { today });
    if (!domain) return <p class="u-note">No item has a start date.</p>;
    const named = lanes.some((l) => l.lane);
    const laneW = named ? Math.min(this.width * 0.26, Math.max(...lanes.map((l) => l.lane.length)) * 6.6 + 16) : 0;
    const innerW = Math.max(80, this.width - laneW - 16);
    const x = scaleTime().domain(domain).range([0, innerW]).nice();
    const ticks = x.ticks(Math.max(2, Math.min(8, Math.floor(innerW / 90))));
    const tickFmt = x.tickFormat();
    // Lane bands, top to bottom
    let y = AXIS_H;
    const bands = lanes.map((lane) => {
      const top = y;
      y += lane.rows * ROW_H + LANE_GAP;
      return { lane, top, height: lane.rows * ROW_H };
    });
    const height = y;
    const order = bands.flatMap((b) => b.lane.bars).sort((a, b) => a.start.getTime() - b.start.getTime());
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const active = this.active !== null && this.active < order.length ? order[this.active] : undefined;
    // Legend in the order of meaning, only for the tones in use
    const used = new Set(this.tasks.map((t) => t.tone ?? 'neutral'));
    const tones = (['ok', 'warn', 'bad', 'accent', 'neutral'] as Tone[]).filter((t) => used.has(t));
    const legend = tones.filter((t) => this.toneLabels[t]).map((t) => ({ label: this.toneLabels[t] as string, fill: TONES[t] }));
    const p = this.testIdPrefix;

    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active) {
      const band = bands.find((b) => b.lane.bars.includes(active));
      const days = Math.round((active.end.getTime() - active.start.getTime()) / 86_400_000);
      tooltip = {
        x: Math.min(Math.max(laneW + x(active.start) + (x(active.end) - x(active.start)) / 2, 90), this.width - 90),
        y: (band?.top ?? 0) + active.row * ROW_H + 4,
        title: active.task.label,
        rows: [
          ...(active.task.lane ? [{ label: this.laneLabel, value: active.task.lane }] : []),
          { label: 'Start', value: DATE.format(active.start) },
          { label: 'End', value: active.open ? 'Open' : DATE.format(active.end) },
          ...(active.open ? [] : [{ label: 'Duration', value: `${days} days` }]),
          ...(today && !active.open ? [{ label: active.end >= today ? 'Ends in' : 'Ended', value: `${Math.abs(Math.round((active.end.getTime() - today.getTime()) / 86_400_000))} days${active.end >= today ? '' : ' ago'}` }] : []),
          ...tooltipRows(active.task.tooltips),
        ],
      };
    }

    return (
      <div class="tl">
        {legend.length > 0 && <Legend items={legend} />}
        <div class="tl-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg
            class="u-chart-svg"
            width={this.width}
            height={height}
            role="img"
            aria-label={chartLabel(this)}
            tabindex={0}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, order)}
          >
            <g transform={`translate(${laneW},0)`}>
              {/* Time axis and quiet vertical gridlines */}
              <g aria-hidden="true">
                {ticks.map((t) => (
                  <g key={`t${t.getTime()}`}>
                    <line x1={x(t)} x2={x(t)} y1={AXIS_H - 4} y2={height - LANE_GAP} class="tl-grid" />
                    <text x={x(t)} y={12} text-anchor="middle" class="tl-axis">
                      {tickFmt(t)}
                    </text>
                  </g>
                ))}
              </g>
              {bands.map((band, b) =>
                band.lane.lane ? (
                  <g key={`lane${band.lane.lane}`} aria-hidden="true">
                    {b > 0 && <line x1={-laneW} x2={innerW} y1={band.top - LANE_GAP / 2} y2={band.top - LANE_GAP / 2} class="tl-lane-rule" />}
                    <text x={-12} y={band.top + 18} text-anchor="end" class="tl-lane">
                      {clipLabel(band.lane.lane, Math.floor((laneW - 16) / 6.6))}
                    </text>
                  </g>
                ) : null
              )}
              {bands.flatMap((band) =>
                band.lane.bars.map((bar) => {
                  const x0 = x(bar.start);
                  const w = Math.max(3, x(bar.end) - x0);
                  const top = band.top + bar.row * ROW_H;
                  const i = order.indexOf(bar);
                  const dimmed = hasSelection && !sameValue(clickValue(bar.task), this.selectedValue);
                  const labelX = Math.min(Math.max(x0, 0), innerW - 40);
                  return (
                    <g
                      key={bar.task.id}
                      class={{ 'u-mark': true, 'tl-item': true }}
                      data-dimmed={String(dimmed)}
                      data-interactive={String(interactive)}
                      data-testid={p ? `${p}-item-${bar.task.id}` : undefined}
                      onMouseEnter={() => (this.active = i)}
                      onClick={() => interactive && emitClick(this, bar.task)}
                    >
                      <rect x={x0 - 2} y={top} width={w + 4} height={ROW_H - 4} fill="transparent" />
                      <text x={labelX} y={top + 11} class={{ 'tl-label': true, 'tl-label--active': active === bar }}>
                        {clipLabel(bar.task.label, Math.max(4, Math.floor((innerW - labelX) / 6.4)))}
                      </text>
                      <rect
                        x={x0}
                        y={top + 15}
                        width={w}
                        height={BAR_H}
                        rx={BAR_H / 2}
                        class={{ 'tl-bar': true, 'tl-bar--open': bar.open, 'u-mark-active': active === bar }}
                        style={{ fill: TONES[bar.task.tone ?? 'neutral'] }}
                      />
                    </g>
                  );
                })
              )}
              {today && x(today) >= 0 && x(today) <= innerW && (
                <g class="tl-today" aria-hidden="true">
                  <line x1={x(today)} x2={x(today)} y1={AXIS_H - 6} y2={height - LANE_GAP} />
                  <text x={x(today) + 4} y={AXIS_H + 2}>
                    Today
                  </text>
                </g>
              )}
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
          hasData={this.tasks.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
