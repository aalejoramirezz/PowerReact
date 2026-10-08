import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, type FrameState } from '../../../functional/frame';
import { KpiFocus, KpiShell, KpiTop, kpiValueText } from '../../../functional/kpi-shell';
import { slug } from '../../../utils/data';
import type { DataPointClickDetail, ExportDetail, ExportFormat, FocusModeDetail, ThemeName, ViewChangeDetail } from '../../../utils/events';
import { formatValue, type FormatSpec } from '../../../utils/formats';
import { formatNumber } from '../../../utils/layout/format';
import { bulletModel, type BulletModel, type KpiStatus } from '../../../utils/layout/kpi';
import type { TableModel, TableRow } from '../../../utils/table/model';

export interface KpiStatusLabels {
  ok?: string;
  warn?: string;
  bad?: string;
}

/**
 * KPI against a target as a bullet graph (Stephen Few): qualitative bands (poor / fair / good from
 * `thresholds`), the value as a bar, the target as a tick, an optional forecast marker, and a status
 * chip saying how far from the target it is. The readable replacement for a gauge.
 */
@Component({
  tag: 'udp-pbi-kpi-bullet',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/kpi.css',
    'udp-pbi-kpi-bullet.css',
  ],
  shadow: true,
})
export class UdpPbiKpiBullet {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** The KPI label. */
  @Prop() heading = '';
  @Prop() info?: string;
  @Prop() calc?: string;
  /** Format of the value, the target, the thresholds and the scale. */
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

  @Prop() value?: number | null;
  @Prop() displayValue?: string;
  @Prop() caption?: string;
  @Prop() icon?: string;
  @Prop() target?: number | null;
  @Prop() targetLabel = 'Target';
  /** Band limits, ascending: two give poor / fair / good (the order flips when lower is better). */
  @Prop() thresholds: number[] = [];
  /** Scale end (default: a nice value above everything drawn). */
  @Prop() max?: number | null;
  /** A projected value (end of period), drawn as a hollow marker. */
  @Prop() forecast?: number | null;
  @Prop() forecastLabel = 'Forecast';
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** Status chip texts (default: "On target" / "Close to target" / "Off target", with the gap). */
  @Prop() statusLabels: KpiStatusLabels = {};

  @State() ui: FrameState = INITIAL_FRAME;
  @State() touchOpen = false;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private fmt = (v: number) => formatValue(v, this.format);

  /** Scale labels: whole percentages, or the value's format. */
  private tick = (v: number) => formatValue(v, this.format?.style === 'percent' ? { style: 'percent', decimals: 0 } : this.format);

  /** A gap between two shares is in percentage points. */
  private gapText = (gap: number) =>
    this.format?.style === 'percent' ? `${formatNumber(Math.abs(gap) * 100, this.format.decimals ?? 1)} pp` : this.fmt(Math.abs(gap));

  private get valueText(): string {
    return kpiValueText({ displayValue: this.displayValue, value: this.value, loading: this.loading, error: this.error, format: this.format });
  }

  private get bullet(): BulletModel {
    return bulletModel({
      value: this.value,
      target: this.target,
      thresholds: this.thresholds,
      max: this.max,
      forecast: this.forecast,
      goodWhen: this.goodWhen,
      ratio: this.format?.style === 'percent',
    });
  }

  /** "On target", or the gap in the value's own format: "1.2% below target". */
  private statusText(b: BulletModel): string | null {
    if (!b.status) return null;
    const custom = this.statusLabels[b.status];
    if (custom) return custom;
    if (b.gap === null) return b.status === 'ok' ? 'On target' : b.status === 'warn' ? 'Close to target' : 'Off target';
    if (Math.abs(b.gap) < 1e-9) return 'On target';
    return `${this.gapText(b.gap)} ${b.gap > 0 ? 'above' : 'below'} ${this.targetLabel.toLowerCase()}`;
  }

  private model = (): TableModel => {
    const b = this.bullet;
    return {
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value', kind: 'number', format: this.format },
      ],
      rows: [
        { metric: this.heading, value: this.value ?? null },
        ...(typeof this.target === 'number' ? [{ metric: this.targetLabel, value: this.target }] : []),
        ...(typeof this.forecast === 'number' ? [{ metric: this.forecastLabel, value: this.forecast }] : []),
        ...b.bands.map((band) => ({ metric: `${band.quality[0]?.toUpperCase()}${band.quality.slice(1)} band (up to)`, value: band.to })),
      ],
    };
  };

  private renderBullet(b: BulletModel, large = false) {
    const pct = (v: number) => `${Math.max(0, Math.min(100, (v / b.max) * 100))}%`;
    const value = typeof this.value === 'number' ? this.value : null;
    const target = typeof this.target === 'number' ? this.target : null;
    const forecast = typeof this.forecast === 'number' ? this.forecast : null;
    const status = this.statusText(b);
    const describe = [
      value !== null ? `${this.heading} ${this.fmt(value)}` : null,
      target !== null ? `${this.targetLabel.toLowerCase()} ${this.fmt(target)}` : null,
      forecast !== null ? `${this.forecastLabel.toLowerCase()} ${this.fmt(forecast)}` : null,
      status,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <div class={{ kb: true, 'kb--large': large }}>
        <div class="kb-track" role="img" aria-label={describe}>
          <span class="kb-bands">
            {b.bands.map((band) => (
              <span key={`${band.from}`} class="kb-band" data-quality={band.quality} style={{ left: pct(band.from), width: `calc(${pct(band.to)} - ${pct(band.from)})` }} />
            ))}
          </span>
          {value !== null && <span class="kb-bar" style={{ width: pct(value) }} />}
          {forecast !== null && <span class="kb-forecast" style={{ left: pct(forecast) }} title={`${this.forecastLabel} ${this.fmt(forecast)}`} />}
          {target !== null && <span class="kb-target" style={{ left: pct(target) }} />}
        </div>
        <div class="kb-scale" aria-hidden="true">
          {b.ticks.map((t) => (
            <span key={String(t)} style={{ left: pct(t) }}>
              {this.tick(t)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  private chip(status: KpiStatus | null, text: string | null) {
    return status && text ? (
      <span class="u-chip kb-status" data-tone={status}>
        {text}
      </span>
    ) : null;
  }

  private renderFocus = () => {
    if (this.ui.view === 'table') {
      const m = this.model();
      return <udp-pbi-data-table frame="none" label={`${this.heading} (table)`} columns={m.columns} rows={m.rows} paginated={false} />;
    }
    const b = this.bullet;
    return (
      <KpiFocus heading={this.heading} info={this.info} calc={this.calc}>
        <p class="kpi-focus__value">{this.valueText}</p>
        <div class="kpi-focus__row">
          {this.chip(b.status, this.statusText(b))}
          {typeof this.target === 'number' && <span class="kpi-focus__caption">{`${this.targetLabel} ${this.fmt(this.target)}`}</span>}
        </div>
        {this.renderBullet(b, true)}
      </KpiFocus>
    );
  };

  render() {
    const id = slug(this.heading);
    const b = this.bullet;
    return (
      <Host data-theme={this.theme}>
        <KpiShell c={this} variant="kpi--bullet" model={this.model} renderFocus={this.renderFocus} onTouch={(open) => (this.touchOpen = open)}>
          <KpiTop heading={this.heading} icon={this.icon} />
          <div class="kpi-main" data-stale={String(this.stale)}>
            <span class="kpi-value" data-testid={`kpi-${id}`} title={this.error}>
              {this.valueText}
            </span>
            <span class="kpi-aside">
              {this.chip(b.status, this.statusText(b))}
              {this.caption && <span class="kpi-caption">{this.caption}</span>}
            </span>
          </div>
          <div class="kb-box" data-stale={String(this.stale)}>
            {this.renderBullet(b)}
            {typeof this.target === 'number' && (
              <p class="kb-legend">
                <i class="kb-legend__target" aria-hidden="true" />
                {`${this.targetLabel} ${this.fmt(this.target)}`}
                {typeof this.forecast === 'number' && [<i key="f" class="kb-legend__forecast" aria-hidden="true" />, `${this.forecastLabel} ${this.fmt(this.forecast)}`]}
              </p>
            )}
          </div>
        </KpiShell>
      </Host>
    );
  }
}
