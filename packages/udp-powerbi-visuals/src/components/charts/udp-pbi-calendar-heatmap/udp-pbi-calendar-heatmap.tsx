import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { ChartTooltip, tooltipRows } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel } from '../../../utils/data';
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
import { calendarLayout, type CalendarCell, type CalendarDay } from '../../../utils/layout/calendar';
import { extent, sequentialStep } from '../../../utils/layout/scales';
import { rampColour, RAMP_STEPS } from '../../../utils/palette';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const TOP = 18;
const LEFT = 30;
const GAP = 3;
const LONG_DATE = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const WEEKDAYS = { monday: ['Mon', '', 'Wed', '', 'Fri', '', ''], sunday: ['', 'Mon', '', 'Wed', '', 'Fri', ''] } as const;

/**
 * Calendar heatmap (FT "change over time" at day grain): one square per day — weeks as columns,
 * weekdays as rows — shaded on the sequential token ramp, so weekly rhythm, seasons and spikes
 * show at a glance. A day without data is the track colour, never the lowest class. Wider than its
 * card, it scrolls inside the card. The arrow keys move by week (← →) and day (↑ ↓); the tooltip
 * names the date; a click (Enter / Space) reports it.
 */
@Component({
  tag: 'udp-pbi-calendar-heatmap',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    'udp-pbi-calendar-heatmap.css',
  ],
  shadow: true,
})
export class UdpPbiCalendarHeatmap {
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
  /** The selected day (its raw value). */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click on a day filters, e.g. 'Date'[Date]. */
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

  /** One entry per day with a value (missing days are "no data"). */
  @Prop() days: CalendarDay[] = [];
  /** What the value counts (tooltip and table), e.g. 'Work requests'. */
  @Prop() valueLabel = 'Value';
  @Prop() weekStart: 'monday' | 'sunday' = 'monday';

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  /** Index into the cells (one per calendar day). */
  @State() active: number | null = null;
  /** Horizontal scroll of the grid (the tooltip lives outside the scroller, so it is never clipped). */
  @State() scrollX = 0;

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

  private get isInteractive(): boolean {
    return this.interactive ?? Boolean(this.crossFilterField);
  }

  private model = (): TableModel => ({
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'value', label: this.valueLabel, kind: 'number', format: this.format },
    ],
    rows: [...this.days].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ [ROW_KEY]: d.raw ?? d.date, date: d.date.slice(0, 10), value: d.value })),
  });

  private pick(cell: CalendarCell): void {
    if (!this.isInteractive) return;
    const value = cell.day?.raw ?? cell.day?.date ?? cell.iso;
    this.dataPointClick.emit({ visualId: this.visualId ?? null, field: this.crossFilterField ?? null, value, label: LONG_DATE.format(cell.date) });
  }

  private onKeyDown(e: KeyboardEvent, cells: CalendarCell[]): void {
    const at = this.active;
    if (e.key === 'Escape' && at !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && at !== null) {
      e.preventDefault();
      const cell = cells[at];
      if (cell) this.pick(cell);
      return;
    }
    const step: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    let next: number | undefined;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = cells.length - 1;
    else if (e.key in step) {
      // Start on the last day with data (the most recent activity)
      const start = at ?? Math.max(0, cells.map((c) => c.value !== null).lastIndexOf(true));
      next = at === null ? start : Math.max(0, Math.min(cells.length - 1, at + (step[e.key] ?? 0)));
    }
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const { cells, weeks, months } = calendarLayout(this.days, { weekStart: this.weekStart });
    const fmt = formatter(this.format);
    const range = extent(cells.map((c) => c.value)) ?? [0, 1];
    const size = Math.max(9, Math.min(16, Math.floor((this.width - LEFT) / Math.max(1, weeks)) - GAP));
    const pitch = size + GAP;
    const svgWidth = LEFT + weeks * pitch;
    const height = TOP + 7 * pitch;
    const interactive = this.isInteractive;
    const active = this.active !== null && this.active < cells.length ? this.active : null;
    const cell = active !== null ? cells[active] : undefined;
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const p = this.testIdPrefix;
    const fill = (c: CalendarCell) => {
      const step = sequentialStep(c.value, range);
      return step ? rampColour(step).fill : 'var(--pbi-track)';
    };
    const selected = (c: CalendarCell) => hasSelection && (sameValue(c.day?.raw ?? c.day?.date, this.selectedValue) || sameValue(c.iso, this.selectedValue));

    return (
      <div class="cal">
        <div class="cal-scroll u-chart-scroll" ref={this.sizer.observe} onScroll={(e: Event) => (this.scrollX = (e.currentTarget as HTMLElement).scrollLeft)}>
          <div class="cal-plot" style={{ width: `${svgWidth}px`, height: `${height}px` }}>
            <svg
              class="u-chart-svg"
              width={svgWidth}
              height={height}
              role="img"
              aria-label={chartLabel(this)}
              tabindex={0}
              onMouseLeave={() => (this.active = null)}
              onBlur={() => (this.active = null)}
              onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, cells)}
            >
              <g aria-hidden="true">
                {months.map((m) => (
                  <text key={`m${m.label}${m.week}`} x={LEFT + m.week * pitch} y={11} class="cal-axis">
                    {m.label}
                  </text>
                ))}
                {WEEKDAYS[this.weekStart].map((d, i) =>
                  d ? (
                    <text key={`d${d}`} x={0} y={TOP + i * pitch + size - 2} class="cal-axis">
                      {d}
                    </text>
                  ) : null
                )}
              </g>
              <g>
                {cells.map((c, i) => (
                  <rect
                    key={c.iso}
                    class={{ 'u-mark': true, 'cal-day': true, 'u-mark-active': active === i || selected(c) }}
                    x={LEFT + c.week * pitch}
                    y={TOP + c.weekday * pitch}
                    width={size}
                    height={size}
                    rx={2.5}
                    style={{ fill: fill(c) }}
                    data-dimmed={String(hasSelection && !selected(c))}
                    data-interactive={String(interactive)}
                    data-testid={p ? `${p}-day-${c.iso}` : undefined}
                    onMouseEnter={() => (this.active = i)}
                    onClick={() => this.pick(c)}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>
        {cell && (
          <ChartTooltip
            x={Math.min(Math.max(LEFT + cell.week * pitch + size / 2 - this.scrollX, 70), this.width - 70)}
            y={TOP + cell.weekday * pitch}
            title={LONG_DATE.format(cell.date)}
            rows={[{ label: this.valueLabel, value: cell.value === null ? 'No data' : fmt(cell.value) }, ...tooltipRows(cell.day?.tooltips)]}
          />
        )}
        {/* The ramp, low to high (no data = the track) */}
        <div class="cal-legend" aria-hidden="true">
          <span>Less</span>
          {Array.from({ length: RAMP_STEPS }, (_, k) => (
            <i key={`s${k}`} style={{ background: rampColour(k + 1).fill }} />
          ))}
          <span>More</span>
          <i class="cal-legend__none" />
          <span>No data</span>
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
        interactive={this.isInteractive}
      />
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.days.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
