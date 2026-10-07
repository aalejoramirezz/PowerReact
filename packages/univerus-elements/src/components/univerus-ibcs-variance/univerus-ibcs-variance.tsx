import { Component, Element, Event, h, Host, Prop, State, type EventEmitter, type FunctionalComponent, type VNode } from '@stencil/core';
import { scaleBand, scaleLinear } from 'd3-scale';
import { INITIAL_FRAME, VisualFrame, type FrameState } from '../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive, type IbcsItem } from '../../utils/data';
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
import type { FormatSpec } from '../../utils/formats';
import { formatNumber, formatPercent, formatSigned } from '../../utils/layout/format';
import { ibcsRows, ibcsScales, pctMarker, SCENARIO_STYLE, type IbcsRow, type Scenario } from '../../utils/layout/ibcs';
import { ibcsTable, ROW_KEY } from '../../utils/table/builders';
import type { TableRow } from '../../utils/table/model';
import { WidthObserver } from '../../utils/width-observer';

const TEXT = '500 11px var(--u-font-body)';
const NUM = '600 11px var(--u-font-display)';
const TITLE = '600 11.5px var(--u-font-display)';

/**
 * Below these widths the panels cannot keep honest scales (the Δ% panel would invert), so the chart
 * keeps its geometry and scrolls sideways inside its card instead of squeezing or widening the page.
 */
const MIN_WIDTH = { horizontal: 480, vertical: 320 } as const;

const goodFill = (good: boolean) => (good ? 'var(--u-ok)' : 'var(--u-bad)');
const goodText = (good: boolean) => (good ? 'var(--u-ok-text)' : 'var(--u-bad-text)');

function trianglePath(x: number, y: number, dir: 'right' | 'left' | 'up' | 'down', s = 6): string {
  switch (dir) {
    case 'right':
      return `M${x - s / 2},${y - s} L${x + s},${y} L${x - s / 2},${y + s} Z`;
    case 'left':
      return `M${x + s / 2},${y - s} L${x - s},${y} L${x + s / 2},${y + s} Z`;
    case 'up':
      return `M${x - s},${y + s / 2} L${x},${y - s} L${x + s},${y + s / 2} Z`;
    default:
      return `M${x - s},${y - s / 2} L${x},${y + s} L${x + s},${y - s / 2} Z`;
  }
}

function scenarioStyle(scenario: Scenario): Record<string, string> {
  const st = SCENARIO_STYLE[scenario];
  return {
    fill: st.fill ? 'var(--u-secondary)' : 'transparent',
    fillOpacity: String(st.fillOpacity),
    stroke: 'var(--u-secondary)',
    strokeWidth: String(st.strokeWidth),
    ...(st.dash ? { strokeDasharray: st.dash } : {}),
  };
}

/** Legend swatches use the same scenario notation as the bars. */
const Swatch: FunctionalComponent<{ style: Record<string, string> }> = ({ style }) => (
  <svg width="12" height="12" aria-hidden="true">
    <rect x="1" y="1" width="10" height="10" rx="2" style={style} />
  </svg>
);

/** Contained sideways scroll for a chart wider than its card; a focusable region so keys can scroll it. */
const ChartScroller: FunctionalComponent<{ active: boolean; label: string }> = ({ active, label }, children) =>
  active ? (
    <div class="u-chart-scroll" tabIndex={0} role="region" aria-label={`${label} (scrolls sideways)`}>
      {children}
    </div>
  ) : (
    children
  );

/**
 * IBCS variance chart (port of Lens `ibcs_variance`): AC vs comparison, ΔAbs bars and Δ% pins,
 * aligned per category. One unit (K / M / bn) for every label, stated in the panel titles.
 * Hover highlights a row / column; a click selects it (cross-filter), dimming the others.
 */
@Component({
  tag: 'univerus-ibcs-variance',
  styleUrls: ['../../styles/motion.css', '../../styles/shadow.css', '../../styles/surfaces.css', 'univerus-ibcs-variance.css'],
  shadow: true,
})
export class UniverusIbcsVariance {
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
  /** Format of the table view and the export (the chart picks one unit, K / M / bn, for every label). */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected category's value; the other rows dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click filters. */
  @Prop() crossFilterField?: string;
  /** A click on a row / column emits `dataPointClick` (default: when `crossFilterField` is set). */
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
  @Prop() loadingRows = 6;

  /** Categories with actual and comparison values. */
  @Prop() data: IbcsItem[] = [];
  /** horizontal: structures (regions, classes, accounts) down the page; vertical: time left to right. */
  @Prop() orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** IBCS notation of the comparison: PY solid grey · PL outlined · FC dashed · BU dotted. */
  @Prop() scenario: Scenario = 'PY';
  /** `higher` for revenue / availability, `lower` for cost / backlog: colour follows business meaning. */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  @Prop() actualLabel = 'AC';
  /** Default: the scenario code. */
  @Prop() comparisonLabel?: string;
  /** Default: `actual` for horizontal, `natural` for vertical. */
  @Prop() sort?: 'actual' | 'variance' | 'natural';
  @Prop() topN = 0;
  /** Δ% axis limit (2 = ±200 %); outliers are drawn at the cap as a triangle with their real label. */
  @Prop() pctCap = 2;
  @Prop() decimals = 1;
  /** Vertical orientation only: plot height in px. */
  @Prop() chartHeight = 420;

  @State() frame: FrameState = INITIAL_FRAME;
  @State() width = 720;
  @State() hoverId: string | null = null;

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

  private get cmpLabel(): string {
    return this.comparisonLabel ?? this.scenario;
  }

  private model = () =>
    ibcsTable(this.data, this.format, { actualLabel: this.actualLabel, comparisonLabel: this.cmpLabel, goodWhen: this.goodWhen });

  private renderChart = (): VNode => {
    const { orientation, scenario, goodWhen, actualLabel, pctCap, decimals } = this;
    const width = this.width;
    const cmpLabel = this.cmpLabel;
    const label = chartLabel(this);
    const interactive = isInteractive(this);
    const rows = ibcsRows(this.data, { goodWhen, sort: this.sort ?? (orientation === 'vertical' ? 'natural' : 'actual'), topN: this.topN });
    const scales = ibcsScales(rows, pctCap);
    const { divisor, suffix } = scales.unit;
    const hasFraction = rows.some((r) => [r.ac, r.cmp].some((v) => v !== null && Math.abs(v % 1) > 1e-9));
    const fmt = (v: number) => formatNumber(v / divisor, divisor === 1 && !hasFraction ? 0 : decimals);
    const unit = suffix ? ` · ${suffix}` : '';
    const cmpStyle = scenarioStyle(scenario);
    const selectedId = rows.find((r) => sameValue(clickValue(r.datum), this.selectedValue))?.datum.id ?? null;

    const opacity = (id: string) => {
      if (selectedId !== null) return selectedId === id ? '1' : '0.35';
      if (this.hoverId !== null) return this.hoverId === id ? '1' : '0.55';
      return '1';
    };
    const rowProps = (row: IbcsRow<IbcsItem>) => ({
      class: 'iv-row',
      'data-interactive': String(interactive),
      onMouseEnter: () => (this.hoverId = row.datum.id),
      onMouseLeave: () => (this.hoverId = null),
      onClick: () => {
        if (interactive) emitClick(this, row.datum);
      },
    });
    const pctText = (row: IbcsRow<IbcsItem>) => (row.dpct === null ? 'n/a' : formatSigned(row.dpct, (v) => formatPercent(v, 0)));

    const legend = (
      <div class="iv-legend">
        <span>
          <Swatch style={{ fill: 'var(--u-ac)' }} />
          {actualLabel}
        </span>
        <span>
          <Swatch style={cmpStyle} />
          {cmpLabel}
        </span>
      </div>
    );

    if (rows.length === 0) {
      return (
        <div class="iv" ref={this.sizer.observe}>
          {legend}
          <p class="iv-empty">No data for the current selection.</p>
        </div>
      );
    }

    /* ───────────── horizontal: categories down the page ───────────── */
    if (orientation === 'horizontal') {
      const W = Math.max(MIN_WIDTH.horizontal, width);
      const rowH = 34;
      const headH = 26;
      const H = headH + rows.length * rowH + 6;
      const labW = Math.min(200, Math.max(84, W * 0.2));
      const gap = 22;
      const inner = W - labW - 2 * gap;
      const p1W = inner * 0.42;
      const p2W = inner * 0.3;
      const p3W = inner * 0.28;
      const x1 = labW;
      const x2 = x1 + p1W + gap;
      const x3 = x2 + p2W + gap;
      const s1 = scaleLinear().domain([0, scales.mainMax]).range([0, p1W - 44]);
      const s2 = scaleLinear().domain(scales.absDomain).range([0, p2W]).nice();
      // Room on both sides for the pin labels (and the capped triangles)
      const s3 = scaleLinear().domain(scales.pctDomain).range([34, p3W - 42]);
      const maxChars = Math.floor((labW - 14) / 6.4);
      const cy = (i: number) => headH + i * rowH + rowH / 2;

      return (
        <div class="iv" ref={this.sizer.observe}>
          {legend}
          <ChartScroller active={W > width} label={label}>
            <svg width={W} height={H} role="img" aria-label={label}>
              <text x={x1} y={14} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`${actualLabel} vs ${cmpLabel}${unit}`}</text>
              <text x={x2} y={14} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`Δ${cmpLabel}${unit}`}</text>
              <text x={x3} y={14} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`Δ${cmpLabel}%`}</text>

              {rows.map((row, i) => {
                const c = cy(i);
                const id = row.datum.id;
                const marker = pctMarker(row.dpct, pctCap);
                const px3 = x3 + s3(marker.value);
                const name = row.datum.label.length > maxChars ? `${row.datum.label.slice(0, maxChars - 1)}…` : row.datum.label;
                return (
                  <g key={id} {...rowProps(row)} style={{ animation: `u-fade .5s var(--u-ease) ${0.15 + i * 0.05}s both` }}>
                    <rect
                      class="iv-band"
                      x={0}
                      y={c - rowH / 2}
                      width={W}
                      height={rowH}
                      rx={6}
                      style={{ fill: 'var(--u-track)', opacity: this.hoverId === id ? '1' : '0' }}
                    />
                    <g class="iv-marks" style={{ opacity: opacity(id) }}>
                      <title>{`${row.datum.label}: ${actualLabel} ${row.ac ?? '—'} · ${cmpLabel} ${row.cmp ?? '—'}`}</title>
                      <text x={labW - 12} y={c + 4} text-anchor="end" style={{ font: TEXT, fill: 'var(--u-text)' }}>
                        {name}
                      </text>

                      {/* Panel 1: comparison behind (scenario notation), AC in front */}
                      <rect x={x1} y={c - rowH * 0.21 + 4} width={s1(Math.max(0, row.cmp ?? 0))} height={rowH * 0.42} rx={2} style={cmpStyle} />
                      <rect x={x1} y={c - rowH * 0.21 - 2} width={s1(Math.max(0, row.ac ?? 0))} height={rowH * 0.42} rx={2} style={{ fill: 'var(--u-ac)' }} />
                      <text x={x1 + s1(Math.max(0, row.ac ?? 0)) + 6} y={c + 2} style={{ font: NUM, fill: 'var(--u-title)' }}>
                        {row.ac !== null ? fmt(row.ac) : '—'}
                      </text>

                      {/* Panel 2: ΔAbs */}
                      <rect
                        x={x2 + Math.min(s2(0), s2(row.dabs))}
                        y={c - rowH * 0.2}
                        width={Math.abs(s2(row.dabs) - s2(0))}
                        height={rowH * 0.4}
                        rx={2}
                        style={{ fill: goodFill(row.good) }}
                      />
                      <text
                        x={x2 + s2(row.dabs) + (row.dabs < 0 ? -5 : 5)}
                        y={c + 4}
                        text-anchor={row.dabs < 0 ? 'end' : 'start'}
                        style={{ font: NUM, fill: goodText(row.good) }}
                      >
                        {formatSigned(row.dabs, fmt)}
                      </text>

                      {/* Panel 3: Δ% pin (outliers capped as a triangle with the real label) */}
                      {marker.shape !== 'none' && <line x1={x3 + s3(0)} x2={px3} y1={c} y2={c} style={{ stroke: goodFill(row.good), strokeWidth: '2' }} />}
                      {marker.shape === 'circle' && <circle cx={px3} cy={c} r={4.5} style={{ fill: goodFill(row.good) }} />}
                      {marker.shape === 'triangle-out' && (
                        <path d={trianglePath(px3, c, marker.value > 0 ? 'right' : 'left')} style={{ fill: goodFill(row.good) }} />
                      )}
                      <text
                        x={px3 + (marker.value < 0 ? -1 : 1) * (marker.capped ? 12 : 9)}
                        y={c + 4}
                        text-anchor={marker.value < 0 ? 'end' : 'start'}
                        style={{ font: NUM, fill: row.dpct === null ? 'var(--u-label)' : goodText(row.good) }}
                      >
                        {pctText(row)}
                      </text>
                    </g>
                  </g>
                );
              })}

              <line x1={x2 + s2(0)} x2={x2 + s2(0)} y1={headH - 4} y2={H - 4} style={{ stroke: 'var(--u-axis)', strokeWidth: '1.5' }} />
              <line x1={x3 + s3(0)} x2={x3 + s3(0)} y1={headH - 4} y2={H - 4} style={{ stroke: 'var(--u-axis)', strokeWidth: '1.5' }} />
            </svg>
          </ChartScroller>
        </div>
      );
    }

    /* ───────────── vertical: time left to right ───────────── */
    const height = this.chartHeight;
    const W = Math.max(MIN_WIDTH.vertical, width);
    const titleH = 18;
    const catH = 22;
    const usable = height - 3 * titleH - catH - 16;
    const h3 = usable * 0.22;
    const h2 = usable * 0.3;
    const h1 = usable - h3 - h2;
    const y3 = titleH;
    const y2 = y3 + h3 + titleH + 8;
    const y1 = y2 + h2 + titleH + 8;
    const x = scaleBand<string>()
      .domain(rows.map((r) => r.datum.id))
      .range([8, W - 8])
      .padding(0.22);
    const bw = x.bandwidth();
    const colW = Math.max(6, Math.min(28, bw * 0.36));
    const absW = Math.max(6, Math.min(28, bw * 0.4));
    const s1 = scaleLinear().domain([0, scales.mainMax]).range([h1, 16]);
    const s2 = scaleLinear().domain(scales.absDomain).range([h2, 0]).nice();
    const s3 = scaleLinear().domain(scales.pctDomain).range([h3 - 14, 14]);

    return (
      <div class="iv" ref={this.sizer.observe}>
        {legend}
        <ChartScroller active={W > width} label={label}>
          <svg width={W} height={height} role="img" aria-label={label}>
            <text x={8} y={y3 - 6} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`Δ${cmpLabel}%`}</text>
            <text x={8} y={y2 - 6} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`Δ${cmpLabel}${unit}`}</text>
            <text x={8} y={y1 - 6} style={{ font: TITLE, fill: 'var(--u-title)' }}>{`${actualLabel} vs ${cmpLabel}${unit}`}</text>

            {rows.map((row, i) => {
              const id = row.datum.id;
              const cx = (x(id) ?? 0) + bw / 2;
              const marker = pctMarker(row.dpct, pctCap);
              const py3 = y3 + s3(marker.value);
              return (
                <g key={id} {...rowProps(row)} style={{ animation: `u-fade .5s var(--u-ease) ${0.15 + i * 0.04}s both` }}>
                  <rect
                    class="iv-band"
                    x={x(id) ?? 0}
                    y={0}
                    width={bw}
                    height={height}
                    rx={6}
                    style={{ fill: 'var(--u-track)', opacity: this.hoverId === id ? '1' : '0' }}
                  />
                  <g class="iv-marks" style={{ opacity: opacity(id) }}>
                    <title>{`${row.datum.label}: ${actualLabel} ${row.ac ?? '—'} · ${cmpLabel} ${row.cmp ?? '—'}`}</title>

                    {/* Δ% pins */}
                    {marker.shape !== 'none' && <line x1={cx} x2={cx} y1={y3 + s3(0)} y2={py3} style={{ stroke: goodFill(row.good), strokeWidth: '2' }} />}
                    {marker.shape === 'circle' && <circle cx={cx} cy={py3} r={4.5} style={{ fill: goodFill(row.good) }} />}
                    {marker.shape === 'triangle-out' && <path d={trianglePath(cx, py3, marker.value > 0 ? 'up' : 'down')} style={{ fill: goodFill(row.good) }} />}
                    <text
                      x={cx}
                      y={py3 + (marker.value < 0 ? 16 : -9)}
                      text-anchor="middle"
                      style={{ font: NUM, fill: row.dpct === null ? 'var(--u-label)' : goodText(row.good) }}
                    >
                      {pctText(row)}
                    </text>

                    {/* ΔAbs */}
                    <rect
                      x={cx - absW / 2}
                      y={y2 + Math.min(s2(0), s2(row.dabs))}
                      width={absW}
                      height={Math.abs(s2(row.dabs) - s2(0))}
                      rx={2}
                      style={{ fill: goodFill(row.good) }}
                    />
                    <text x={cx} y={y2 + s2(row.dabs) + (row.dabs < 0 ? 13 : -5)} text-anchor="middle" style={{ font: NUM, fill: goodText(row.good) }}>
                      {formatSigned(row.dabs, fmt)}
                    </text>

                    {/* AC vs comparison columns */}
                    <rect
                      x={cx + colW * 0.35 - colW / 2}
                      y={y1 + s1(Math.max(0, row.cmp ?? 0))}
                      width={colW}
                      height={h1 - s1(Math.max(0, row.cmp ?? 0))}
                      rx={2}
                      style={cmpStyle}
                    />
                    <rect
                      x={cx - colW * 0.35 - colW / 2}
                      y={y1 + s1(Math.max(0, row.ac ?? 0))}
                      width={colW}
                      height={h1 - s1(Math.max(0, row.ac ?? 0))}
                      rx={2}
                      style={{ fill: 'var(--u-ac)' }}
                    />
                    <text x={cx - colW * 0.35} y={y1 + s1(Math.max(0, row.ac ?? 0)) - 5} text-anchor="middle" style={{ font: NUM, fill: 'var(--u-title)' }}>
                      {row.ac !== null ? fmt(row.ac) : '—'}
                    </text>
                    <text x={cx} y={y1 + h1 + 16} text-anchor="middle" style={{ font: TEXT, fill: 'var(--u-text)' }}>
                      {row.datum.label}
                    </text>
                  </g>
                </g>
              );
            })}

            <line x1={8} x2={W - 8} y1={y3 + s3(0)} y2={y3 + s3(0)} style={{ stroke: 'var(--u-axis)', strokeWidth: '1.5' }} />
            <line x1={8} x2={W - 8} y1={y2 + s2(0)} y2={y2 + s2(0)} style={{ stroke: 'var(--u-axis)', strokeWidth: '1.5' }} />
            <line x1={8} x2={W - 8} y1={y1 + h1} y2={y1 + h1} style={{ stroke: 'var(--u-axis)', strokeWidth: '1.5' }} />
          </svg>
        </ChartScroller>
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
          hasData={this.data.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
