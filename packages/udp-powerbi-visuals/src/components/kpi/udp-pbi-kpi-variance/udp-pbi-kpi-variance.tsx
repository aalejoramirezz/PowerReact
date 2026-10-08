import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, type FrameState } from '../../../functional/frame';
import { KpiFocus, KpiShell, KpiTop, kpiValueText } from '../../../functional/kpi-shell';
import { slug } from '../../../utils/data';
import type { DataPointClickDetail, ExportDetail, ExportFormat, FocusModeDetail, ThemeName, ViewChangeDetail } from '../../../utils/events';
import { formatValue, type FormatSpec } from '../../../utils/formats';
import { formatPercent, formatSigned } from '../../../utils/layout/format';
import { pctMarker, scenarioStyle, type Scenario } from '../../../utils/layout/ibcs';
import { kpiVariance, type KpiVariance } from '../../../utils/layout/kpi';
import type { TableModel, TableRow } from '../../../utils/table/model';

/** Δ% axis: ±50 % fills a half; beyond that the pin becomes a triangle at the edge with its real label. */
const PCT_CAP = 0.5;

/**
 * IBCS variance KPI: the actual (AC) against one scenario (PY, PL, FC or BU) in IBCS notation —
 * the AC bar solid, the scenario bar in its notation (PY grey, PL outlined, FC hatched-dashed,
 * BU dotted), the absolute variance as a green / red bar and the relative variance as a pin.
 * Answers "better or worse than plan / last year, and by how much?".
 */
@Component({
  tag: 'udp-pbi-kpi-variance',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/kpi.css',
    'udp-pbi-kpi-variance.css',
  ],
  shadow: true,
})
export class UdpPbiKpiVariance {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** The KPI label. */
  @Prop() heading = '';
  @Prop() info?: string;
  @Prop() calc?: string;
  /** Format of the actual, the comparison and the absolute variance. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  @Prop() stale = false;
  @Prop() crossFilterField?: string;
  @Prop() interactive?: boolean;
  @Prop() active?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() theme?: ThemeName;
  @Prop() index = 0;

  /** The actual (AC). */
  @Prop() actual?: number | null;
  /** Ready text for the headline; wins over `actual`. */
  @Prop() displayValue?: string;
  /** The scenario value (prior year, plan, forecast or budget). */
  @Prop() comparison?: number | null;
  @Prop() scenario: Scenario = 'PY';
  /** Whether a higher actual is favourable (colours the variances). */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  @Prop() actualLabel = 'AC';
  /** Name of the scenario row (default: the scenario code). */
  @Prop() comparisonLabel?: string;
  /** Decimals of the relative variance. */
  @Prop() decimals = 1;
  @Prop() caption?: string;
  @Prop() icon?: string;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() touchOpen = false;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private fmt = (v: number) => formatValue(v, this.format);

  private get valueText(): string {
    return kpiValueText({ displayValue: this.displayValue, value: this.actual, loading: this.loading, error: this.error, format: this.format });
  }

  private get scenarioName(): string {
    return this.comparisonLabel ?? this.scenario;
  }

  private get variance(): KpiVariance {
    return kpiVariance(this.actual, this.comparison, this.goodWhen);
  }

  private model = (): TableModel => {
    const v = this.variance;
    const num = (x: number | null | undefined) => (typeof x === 'number' ? this.fmt(x) : null);
    return {
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ],
      rows: [
        { metric: `${this.heading} (${this.actualLabel})`, value: num(this.actual) },
        { metric: this.scenarioName, value: num(this.comparison) },
        { metric: `Δ${this.scenario}`, value: v.delta === null ? null : formatSigned(v.delta, this.fmt) },
        { metric: `Δ${this.scenario}%`, value: v.deltaPct === null ? null : formatSigned(v.deltaPct, (a) => formatPercent(a, this.decimals)) },
      ],
    };
  };

  private renderRows(large = false) {
    const v = this.variance;
    const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%`;
    const actual = typeof this.actual === 'number' ? this.actual : null;
    const comparison = typeof this.comparison === 'number' ? this.comparison : null;
    const tone = v.favourable === null ? 'var(--pbi-secondary)' : v.favourable ? 'var(--pbi-ok)' : 'var(--pbi-bad)';
    // Text on the card uses the contrast-checked delta roles; the status colours only fill marks
    const text = v.favourable === null ? undefined : v.favourable ? 'var(--pbi-delta-up)' : 'var(--pbi-delta-down)';
    const absShare = v.delta === null ? 0 : Math.abs(v.delta) / v.barMax / 2;
    const marker = pctMarker(v.deltaPct, PCT_CAP);
    const pinShare = (Math.abs(marker.value) / PCT_CAP) * 0.5;
    const right = (v.delta ?? 0) >= 0;
    const H = large ? 14 : 10;
    const describe = [
      actual !== null ? `${this.actualLabel} ${this.fmt(actual)}` : null,
      comparison !== null ? `${this.scenarioName} ${this.fmt(comparison)}` : null,
      v.delta !== null ? `Δ${this.scenario} ${formatSigned(v.delta, this.fmt)}` : null,
      v.deltaPct !== null ? `Δ${this.scenario}% ${formatSigned(v.deltaPct, (a) => formatPercent(a, this.decimals))}` : null,
      v.favourable === null ? null : v.favourable ? 'favourable' : 'unfavourable',
    ]
      .filter(Boolean)
      .join(', ');
    const row = (key: string, label: string, bar: unknown, value: string, valueTone?: string) => (
      <div key={key} class="kv-row">
        <span class="kv-label">{label}</span>
        <svg class="kv-bar" width="100%" height={H} aria-hidden="true">
          {bar}
        </svg>
        <span class="kv-value" style={valueTone ? { color: valueTone } : undefined}>
          {value}
        </span>
      </div>
    );
    return (
      <div class={{ kv: true, 'kv--large': large }} role="img" aria-label={describe}>
        {row('ac', this.actualLabel, actual !== null && <rect x="0" y="0" width={pct(Math.abs(actual) / v.barMax)} height={H} rx="1.5" class="kv-ac" />, actual !== null ? this.fmt(actual) : '—')}
        {row(
          'cmp',
          this.scenarioName,
          comparison !== null && <rect x="0.75" y="0.75" width={pct(Math.abs(comparison) / v.barMax)} height={H - 1.5} rx="1.5" style={scenarioStyle(this.scenario)} />,
          comparison !== null ? this.fmt(comparison) : '—'
        )}
        {row(
          'abs',
          `Δ${this.scenario}`,
          [
            <line key="axis" x1="50%" x2="50%" y1="-2" y2={H + 2} class="kv-axis" />,
            v.delta !== null && <rect key="bar" x={right ? '50%' : pct(0.5 - absShare)} y="1" width={pct(absShare)} height={H - 2} style={{ fill: tone }} />,
          ],
          v.delta !== null ? formatSigned(v.delta, this.fmt) : '—',
          text
        )}
        {row(
          'pct',
          `Δ${this.scenario}%`,
          [
            <line key="axis" x1="50%" x2="50%" y1="-2" y2={H + 2} class="kv-axis" />,
            marker.shape !== 'none' && <line key="stem" x1="50%" x2={pct(0.5 + (right ? pinShare : -pinShare))} y1={H / 2} y2={H / 2} class="kv-stem" />,
            marker.shape === 'circle' && <circle key="pin" cx={pct(0.5 + (right ? pinShare : -pinShare))} cy={H / 2} r={H / 2.6} style={{ fill: tone }} />,
            marker.shape === 'triangle-out' && (
              <rect key="cap" x={right ? '97%' : '0%'} y={H / 2 - H / 3} width="3%" height={(H * 2) / 3} style={{ fill: tone }} />
            ),
          ],
          v.deltaPct !== null ? formatSigned(v.deltaPct, (a) => formatPercent(a, this.decimals)) : '—',
          text
        )}
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
        {this.caption && <p class="kpi-focus__caption">{this.caption}</p>}
        {this.renderRows(true)}
      </KpiFocus>
    );
  };

  render() {
    const id = slug(this.heading);
    return (
      <Host data-theme={this.theme}>
        <KpiShell c={this} variant="kpi--variance" model={this.model} renderFocus={this.renderFocus} onTouch={(open) => (this.touchOpen = open)}>
          <KpiTop heading={this.heading} icon={this.icon} />
          <div class="kpi-main" data-stale={String(this.stale)}>
            <span class="kpi-value" data-testid={`kpi-${id}`} title={this.error}>
              {this.valueText}
            </span>
            {this.caption && (
              <span class="kpi-aside">
                <span class="kpi-caption">{this.caption}</span>
              </span>
            )}
          </div>
          <div class="kv-box" data-stale={String(this.stale)}>
            {this.renderRows()}
          </div>
        </KpiShell>
      </Host>
    );
  }
}
