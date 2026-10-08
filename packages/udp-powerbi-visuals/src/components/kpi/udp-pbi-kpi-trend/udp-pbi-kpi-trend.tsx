import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, type FrameState } from '../../../functional/frame';
import { derivedDelta, KpiDeltaText, KpiFocus, KpiShell, KpiTop, kpiValueText, type KpiDelta } from '../../../functional/kpi-shell';
import { slug } from '../../../utils/data';
import type { DataPointClickDetail, ExportDetail, ExportFormat, FocusModeDetail, ThemeName, ViewChangeDetail } from '../../../utils/events';
import { formatValue, type FormatSpec } from '../../../utils/formats';
import { sparkline, type KpiPoint } from '../../../utils/layout/kpi';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const SPARK_H = 46;

/**
 * KPI with its recent trend: the number, its delta and a sparkline of the last periods with the
 * current one marked, the lowest and highest points and an optional target line. Answers "how much,
 * and which way is it going?". Without `value` the latest period is the headline; without a
 * comparison the delta is against the previous period. Hovering the line reads any period.
 */
@Component({
  tag: 'udp-pbi-kpi-trend',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/kpi.css',
    'udp-pbi-kpi-trend.css',
  ],
  shadow: true,
})
export class UdpPbiKpiTrend {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** The KPI label. */
  @Prop() heading = '';
  /** Curtain: what the number means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Format of the number, the series and the target. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  @Prop() stale = false;
  @Prop() crossFilterField?: string;
  @Prop() interactive?: boolean;
  /** Toggle state; leave undefined for a plain action. */
  @Prop() active?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() theme?: ThemeName;
  @Prop() index = 0;

  /** The headline number (default: the latest period's value). */
  @Prop() value?: number | null;
  /** Ready text for the number; wins over `value`. */
  @Prop() displayValue?: string;
  /** Quiet words beside the number. */
  @Prop() caption?: string;
  /** Explicit delta; otherwise derived from `comparisonValue` (default: the previous period). */
  @Prop() delta?: KpiDelta;
  @Prop() comparisonValue?: number | null;
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** Suffix of the derived delta (default: "vs <previous period>"). */
  @Prop() deltaLabel?: string;
  /** Icon mark by name, or the `icon` slot. */
  @Prop() icon?: string;
  /** The recent periods, oldest first. */
  @Prop() series: KpiPoint[] = [];
  /** A target drawn as a dashed line. */
  @Prop() target?: number | null;
  @Prop() targetLabel = 'Target';
  /** What the line covers, e.g. "Last 12 months". */
  @Prop() periodLabel?: string;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() touchOpen = false;
  @State() width = 0;
  /** Period under the pointer (index into `series`). */
  @State() hover: number | null = null;

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

  private get latest(): { index: number; point: KpiPoint } | null {
    for (let i = this.series.length - 1; i >= 0; i--) {
      const p = this.series[i] as KpiPoint;
      if (typeof p.value === 'number' && Number.isFinite(p.value)) return { index: i, point: p };
    }
    return null;
  }

  private get headline(): number | null | undefined {
    return this.value !== undefined ? this.value : (this.latest?.point.value ?? null);
  }

  private get deltaInfo(): KpiDelta | null {
    if (this.delta) return this.delta;
    if (this.comparisonValue !== undefined) return derivedDelta(this.headline, this.comparisonValue, this.goodWhen, this.deltaLabel);
    const last = this.latest;
    const prev = last ? this.series.slice(0, last.index).reverse().find((p) => typeof p.value === 'number') : undefined;
    return prev ? derivedDelta(this.headline, prev.value, this.goodWhen, this.deltaLabel ?? `vs ${prev.label}`) : null;
  }

  private fmt = (v: number) => formatValue(v, this.format);

  private get valueText(): string {
    return kpiValueText({ displayValue: this.displayValue, value: this.headline, loading: this.loading, error: this.error, format: this.format });
  }

  private model = (): TableModel => ({
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'value', label: this.heading || 'Value', kind: 'number', format: this.format },
      ...(typeof this.target === 'number' ? [{ key: 'target', label: this.targetLabel, kind: 'number' as const, format: this.format }] : []),
    ],
    rows: this.series.map((p) => ({ period: p.label, value: p.value, ...(typeof this.target === 'number' ? { target: this.target } : {}) })),
  });

  private onMove = (e: PointerEvent, count: number) => {
    const box = (e.currentTarget as SVGElement).getBoundingClientRect();
    const t = (e.clientX - box.left) / Math.max(1, box.width);
    this.hover = Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))));
  };

  private renderSpark(height: number, width: number) {
    if (this.series.length < 2) return null;
    const s = sparkline(this.series, width, height, { target: this.target });
    const point = (k: number | null) => (k === null ? null : s.points[k]);
    const last = point(s.last);
    const lo = point(s.min);
    const hi = point(s.max);
    const hovered = this.hover !== null ? s.points.find((p) => p.i === this.hover) : undefined;
    const reading = hovered ?? (last ? { ...last } : undefined);
    const first = this.series[0] as KpiPoint;
    const end = this.series[this.series.length - 1] as KpiPoint;
    return (
      <div class="kt-spark">
        <svg
          width={width}
          height={height}
          class="kt-svg"
          role="img"
          aria-label={`${this.heading}: ${this.series.length} periods from ${first.label} to ${end.label}${lo && hi ? `, lowest ${this.fmt(lo.value)} (${lo.label}), highest ${this.fmt(hi.value)} (${hi.label})` : ''}`}
          onPointerMove={(e: PointerEvent) => this.onMove(e, this.series.length)}
          onPointerLeave={() => (this.hover = null)}
        >
          <path d={s.area} class="kt-area" />
          {s.targetY !== null && <line x1={0} x2={width} y1={s.targetY} y2={s.targetY} class="kt-target" />}
          <path d={s.line} class="kt-line" />
          {lo && hi && lo !== hi && [<circle key="lo" cx={lo.x} cy={lo.y} r={2.5} class="kt-extreme" />, <circle key="hi" cx={hi.x} cy={hi.y} r={2.5} class="kt-extreme" />]}
          {hovered && <line x1={hovered.x} x2={hovered.x} y1={0} y2={height} class="kt-cursor" />}
          {last && <circle cx={last.x} cy={last.y} r={3.5} class="kt-last" />}
          {hovered && hovered !== last && <circle cx={hovered.x} cy={hovered.y} r={3} class="kt-hover" />}
        </svg>
        <div class="kt-foot">
          <span>{reading ? `${reading.label} · ${this.fmt(reading.value)}` : first.label}</span>
          <span>{typeof this.target === 'number' ? `${this.targetLabel} ${this.fmt(this.target)}` : (this.periodLabel ?? `${first.label}–${end.label}`)}</span>
        </div>
      </div>
    );
  }

  private renderFocus = () => {
    if (this.ui.view === 'table') {
      const m = this.model();
      return <udp-pbi-data-table frame="none" label={`${this.heading} (table)`} columns={m.columns} rows={m.rows} paginated={false} />;
    }
    return (
      <KpiFocus heading={this.heading} info={this.info} calc={this.calc}>
        <p class="kpi-focus__value">{this.valueText}</p>
        <div class="kpi-focus__row">
          <KpiDeltaText delta={this.deltaInfo} />
          {this.periodLabel && <span class="kpi-focus__caption">{this.periodLabel}</span>}
        </div>
        <div class="kt-focus-spark">{this.renderSpark(120, 560)}</div>
      </KpiFocus>
    );
  };

  render() {
    const id = slug(this.heading);
    return (
      <Host data-theme={this.theme}>
        <KpiShell c={this} variant="kpi--trend" model={this.model} renderFocus={this.renderFocus} onTouch={(open) => (this.touchOpen = open)}>
          <KpiTop heading={this.heading} icon={this.icon} />
          <div class="kpi-main" data-stale={String(this.stale)}>
            <span class="kpi-value" data-testid={`kpi-${id}`} title={this.error}>
              {this.valueText}
            </span>
            <span class="kpi-aside">
              <KpiDeltaText delta={this.deltaInfo} />
              {this.caption && <span class="kpi-caption">{this.caption}</span>}
            </span>
          </div>
          <div class="kt-box" ref={this.sizer.observe} data-stale={String(this.stale)}>
            {this.renderSpark(SPARK_H, this.width || 240)}
          </div>
        </KpiShell>
      </Host>
    );
  }
}
