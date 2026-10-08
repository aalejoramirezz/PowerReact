import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { scaleLinear } from 'd3-scale';
import { ChartTooltip, GridLines, Legend, ReferenceLine, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
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
import { axisDomain, labelledPoints, nearestPoint, plottable, radiusScale, type ScatterPoint } from '../../../utils/layout/scatter';
import { seriesColour } from '../../../utils/palette';
import { nextIndex } from '../../../utils/roving';
import type { ReferenceLineSpec } from '../../../utils/series-chart';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableColumn, TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

// The top margin holds the y caption, clear of the points near the top
const M = { top: 26, right: 16, bottom: 34 };

/**
 * Scatter / bubble (FT "correlation"): how two measures relate across categories, optionally with
 * a third as the bubble's area and a group as its colour. Reference lines on x and y split the
 * plot into labelled quadrants (e.g. "high criticality, poor condition"). The selected point and
 * the top N are labelled directly. Hover, or the arrow keys (points in x order), show the tooltip;
 * a click (Enter / Space) reports the point's category.
 */
@Component({
  tag: 'udp-pbi-scatter',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-scatter.css'],
  shadow: true,
})
export class UdpPbiScatter {
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
  /** Format of the y values (and the default for x). */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected point (its raw value or id): labelled and ringed, the others dim. */
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

  @Prop() points: ScatterPoint[] = [];
  /** What x and y measure (axis captions, tooltip and table). */
  @Prop() xLabel = 'x';
  @Prop() yLabel = 'y';
  /** What the bubble size measures (omit when there is no size). */
  @Prop() sizeLabel?: string;
  @Prop() xFormat?: FormatSpec;
  @Prop() sizeFormat?: FormatSpec;
  /** Header of the category column in the table view and the export. */
  @Prop() categoryLabel = 'Category';
  /** Vertical reference line at an x value (target, average). */
  @Prop() xReference?: ReferenceLineSpec;
  /** Horizontal reference line at a y value. */
  @Prop() yReference?: ReferenceLineSpec;
  /** Quadrant captions when both references are set: [top-left, top-right, bottom-left, bottom-right]. */
  @Prop() quadrantLabels?: string[];
  /** Start an axis at zero. */
  @Prop() xZero = false;
  @Prop() yZero = false;
  /** Label the N largest points (by size, else y) directly. */
  @Prop() labelTop = 5;
  /** Plot height in px. */
  @Prop() chartHeight = 300;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  /** Index into the plottable points (x order). */
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

  private groups(): string[] {
    return [...new Set(this.points.map((p) => p.group).filter((g): g is string => Boolean(g)))];
  }

  private model = (): TableModel => {
    const extras = new Map<string, FormatSpec | undefined>();
    for (const p of this.points) for (const t of p.tooltips ?? []) if (!extras.has(t.label)) extras.set(t.label, t.format);
    const grouped = this.groups().length > 0;
    const sized = this.points.some((p) => typeof p.size === 'number');
    const columns: TableColumn[] = [
      { key: 'category', label: this.categoryLabel },
      ...(grouped ? [{ key: 'group', label: 'Group' }] : []),
      { key: 'x', label: this.xLabel, kind: 'number', format: this.xFormat ?? this.format },
      { key: 'y', label: this.yLabel, kind: 'number', format: this.format },
      ...(sized ? [{ key: 'size', label: this.sizeLabel ?? 'Size', kind: 'number' as const, format: this.sizeFormat }] : []),
      ...[...extras].map(([label, format]) => ({ key: `t:${label}`, label, kind: 'number' as const, format })),
    ];
    const rows = this.points.map((p) => ({
      [ROW_KEY]: clickValue(p),
      category: p.label,
      group: p.group ?? null,
      x: p.x,
      y: p.y,
      size: p.size ?? null,
      ...Object.fromEntries((p.tooltips ?? []).map((t) => [`t:${t.label}`, t.value])),
    }));
    return { columns, rows };
  };

  private onKeyDown(e: KeyboardEvent, points: ScatterPoint[]): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const p = points[this.active];
      if (p && isInteractive(this)) emitClick(this, p);
      return;
    }
    const map: Record<string, string> = { ArrowUp: 'ArrowRight', ArrowDown: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, points.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const points = plottable(this.points);
    const fy = formatter(this.format);
    const fx = formatter(this.xFormat ?? this.format);
    const fs = formatter(this.sizeFormat);
    const groups = this.groups();
    const colour = (p: ScatterPoint) => seriesColour(Math.max(0, groups.indexOf(p.group ?? '')), Math.max(1, groups.length)).fill;
    const xr = this.xReference && Number.isFinite(this.xReference.value) ? this.xReference : undefined;
    const yr = this.yReference && Number.isFinite(this.yReference.value) ? this.yReference : undefined;

    const yDomain = axisDomain(points.map((p) => p.y), { zero: this.yZero, include: yr ? [yr.value] : [] });
    const xDomain = axisDomain(points.map((p) => p.x), { zero: this.xZero, include: xr ? [xr.value] : [] });
    const height = this.chartHeight;
    const innerH = Math.max(80, height - M.top - M.bottom);
    const y = scaleLinear().domain(yDomain).range([innerH, 0]);
    const yTicks = y.ticks(4);
    const left = Math.max(30, Math.round(Math.max(...yTicks.map((t) => fy(t).length)) * 6.6) + 14);
    const innerW = Math.max(80, this.width - left - M.right);
    const x = scaleLinear().domain(xDomain).range([0, innerW]);
    const xTicks = x.ticks(Math.max(2, Math.min(6, Math.floor(innerW / 90))));
    const radius = radiusScale(points, Math.min(22, innerW / 18));

    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const rankKey = (p: ScatterPoint) => (typeof p.size === 'number' ? p.size : p.y);
    const ranks = new Map(
      [...points]
        .sort((a, b) => (rankKey(b) ?? 0) - (rankKey(a) ?? 0))
        .map((p, i) => [p, i] as const)
    );
    const positions = points.map((p) => ({
      x: x(p.x),
      y: y(p.y),
      r: radius(p.size),
      label: p.label,
      rank: ranks.get(p) ?? Infinity,
      selected: hasSelection && sameValue(clickValue(p), this.selectedValue),
    }));
    const labelled = labelledPoints(positions, this.labelTop);
    const interactive = isInteractive(this);
    const active = this.active !== null && this.active < points.length ? this.active : null;

    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active !== null) {
      const p = points[active] as ScatterPoint & { x: number; y: number };
      const pos = positions[active] as { x: number; y: number; r: number };
      const rows: TooltipRow[] = [
        ...(p.group ? [{ label: 'Group', value: p.group, swatch: colour(p) }] : []),
        { label: this.xLabel, value: fx(p.x) },
        { label: this.yLabel, value: fy(p.y) },
        ...(typeof p.size === 'number' ? [{ label: this.sizeLabel ?? 'Size', value: fs(p.size) }] : []),
        ...tooltipRows(p.tooltips),
      ];
      tooltip = { x: Math.min(Math.max(left + pos.x, left + 70), left + innerW - 40), y: M.top + pos.y - pos.r, title: p.label, rows };
    }

    // Quadrant captions sit in the corners of the plot, quiet (context, not data)
    const quads = xr && yr && this.quadrantLabels?.length === 4 ? this.quadrantLabels : null;
    const qx = xr ? x(xr.value) : 0;
    const qy = yr ? y(yr.value) : 0;

    return (
      <div class="sc">
        {groups.length > 1 && <Legend items={groups.map((g, i) => ({ label: g, fill: seriesColour(i, groups.length).fill }))} />}
        <div class="sc-plot" style={{ height: `${height}px` }} ref={this.sizer.observe}>
          <svg
            class="u-chart-svg"
            width={this.width}
            height={height}
            role="img"
            aria-label={chartLabel(this)}
            tabindex={0}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, points)}
          >
            <g transform={`translate(${left},${M.top})`}>
              <GridLines orientation="rows" ticks={yTicks} pos={y} from={0} to={innerW} format={fy} />
              <GridLines orientation="columns" ticks={xTicks} pos={x} from={0} to={innerH} format={fx} />
              {/* Axis captions at the ends (no rotated titles) */}
              <text x={innerW} y={innerH + 30} text-anchor="end" class="sc-caption">
                {`${this.xLabel} →`}
              </text>
              <text x={0} y={-12} class="sc-caption">
                {`↑ ${this.yLabel}`}
              </text>

              {quads && (
                <g class="sc-quads" aria-hidden="true">
                  <text x={6} y={14}>{quads[0]}</text>
                  <text x={innerW - 6} y={14} text-anchor="end">
                    {quads[1]}
                  </text>
                  <text x={6} y={innerH - 8}>{quads[2]}</text>
                  <text x={innerW - 6} y={innerH - 8} text-anchor="end">
                    {quads[3]}
                  </text>
                </g>
              )}
              {xr && <ReferenceLine orientation="vertical" at={qx} from={0} to={innerH} label={xr.label ? `${xr.label} ${fx(xr.value)}` : fx(xr.value)} />}
              {yr && <ReferenceLine orientation="horizontal" at={qy} from={0} to={innerW} label={yr.label ? `${yr.label} ${fy(yr.value)}` : fy(yr.value)} />}

              <g class="sc-points">
                {/* Largest first so small bubbles stay on top and clickable */}
                {points
                  .map((p, i) => ({ p, i }))
                  .sort((a, b) => (positions[b.i]?.r ?? 0) - (positions[a.i]?.r ?? 0))
                  .map(({ p, i }) => {
                    const pos = positions[i] as { x: number; y: number; r: number; selected: boolean };
                    return (
                      <circle
                        key={p.id}
                        class={{ 'u-mark': true, 'sc-dot': true, 'u-mark-active': active === i || pos.selected }}
                        cx={pos.x}
                        cy={pos.y}
                        r={pos.r}
                        data-dimmed={String(hasSelection && !pos.selected)}
                        data-interactive={String(interactive)}
                        data-testid={this.testIdPrefix ? `${this.testIdPrefix}-point-${p.id}` : undefined}
                        style={{ '--dot': colour(p), animationDelay: `${300 + Math.min(i, 30) * 12}ms` }}
                      />
                    );
                  })}
              </g>
              <g class="sc-labels" aria-hidden="true">
                {[...labelled].map((i) => {
                  const pos = positions[i] as { x: number; y: number; r: number; label: string; selected: boolean };
                  return (
                    <text key={`l${points[i]?.id}`} x={pos.x + pos.r + 4} y={pos.y + 4} class={{ 'sc-label': true, 'sc-label--selected': pos.selected }}>
                      {pos.label}
                    </text>
                  );
                })}
              </g>
              {/* Pointer capture for the nearest point (bubbles can be tiny) */}
              <rect
                class="sc-capture"
                width={innerW}
                height={innerH}
                fill="transparent"
                data-interactive={String(interactive && active !== null)}
                onMouseMove={(e: MouseEvent) => {
                  const box = (e.currentTarget as Element).getBoundingClientRect();
                  this.active = nearestPoint(positions, e.clientX - box.left, e.clientY - box.top);
                }}
                onClick={() => {
                  const p = active !== null ? points[active] : undefined;
                  if (p && interactive) emitClick(this, p);
                }}
              />
            </g>
          </svg>
          {tooltip && <ChartTooltip x={tooltip.x} y={tooltip.y} title={tooltip.title} rows={tooltip.rows} />}
        </div>
        {points.length < this.points.length && <p class="u-note">{`${this.points.length - points.length} without both values not shown`}</p>}
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
          hasData={this.points.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
