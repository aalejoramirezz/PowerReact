import { Component, Element, Event, h, Host, Prop, State, type EventEmitter, type VNode } from '@stencil/core';
import { ActionMenu, Curtain, exportItems, FocusDialog, INITIAL_FRAME, openFocus, type FrameState, type MenuItem } from '../../functional/frame';
import type {
  DataPointClickDetail,
  ExportDetail,
  ExportFormat,
  FocusModeDetail,
  ThemeName,
  ViewChangeDetail,
} from '../../utils/events';
import { formatValue, type FormatSpec } from '../../utils/formats';
import { UI_ICONS } from '../../utils/icons';
import type { TableModel, TableRow } from '../../utils/table/model';

export interface HeroMetric {
  label: string;
  /** A number (formatted with `format`) or ready text. */
  value: number | string | null;
  format?: FormatSpec;
}

export interface HeroMeter {
  label: string;
  /** 0..1 */
  value: number;
}

const TICKS = 60;
const PCT1: FormatSpec = { style: 'percent', decimals: 1 };

/**
 * Hero KPI (Lens `kpi_hero`, dark mockup "SLA compliance"): one dominant number, up to four
 * supporting metrics and a 60-tick meter that wipes in once. Use it when one headline metric
 * deserves the most space on the page (principle 7). Hover or focus drops the curtain.
 */
@Component({
  tag: 'univerus-kpi-hero',
  styleUrls: ['../../styles/motion.css', '../../styles/shadow.css', '../../styles/surfaces.css', 'univerus-kpi-hero.css'],
  shadow: true,
})
export class UniverusKpiHero {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** The headline label (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  /** Curtain: what the number means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Format of `value` (and of the comparison). */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' value shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the hero's own table. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  /** Entrance stagger position. */
  @Prop() index = 0;

  /** The headline number. */
  @Prop() value?: number | null;
  /** Already formatted text; wins over `value`. */
  @Prop() displayValue?: string;
  /** Small unit after the number, e.g. "%". */
  @Prop() unit?: string;
  /** Explicit delta; otherwise derived from `comparison-value`. */
  @Prop() delta?: { text: string; favourable: boolean };
  @Prop() comparisonValue?: number | null;
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** Suffix of the derived delta, e.g. "vs August". */
  @Prop() deltaLabel?: string;
  /** Up to four supporting metrics. */
  @Prop() metrics: HeroMetric[] = [];
  /** Optional 60-tick utilisation meter. */
  @Prop() meter?: HeroMeter;

  @State() frame: FrameState = INITIAL_FRAME;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private get valueText(): string {
    if (this.displayValue !== undefined && this.displayValue !== null) return this.displayValue;
    if (this.value === null || this.value === undefined) return this.loading && !this.error ? '…' : '—';
    return formatValue(this.value, this.format);
  }

  private get deltaInfo(): { text: string; favourable: boolean } | null {
    if (this.delta) return this.delta;
    const v = this.value;
    const c = this.comparisonValue;
    if (v === null || v === undefined || c === null || c === undefined || c === 0) return null;
    const change = (v - c) / Math.abs(c);
    const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
    const favourable = this.goodWhen === 'higher' ? change >= 0 : change <= 0;
    return { text: `${arrow} ${formatValue(Math.abs(change), PCT1)}${this.deltaLabel ? ` ${this.deltaLabel}` : ''}`, favourable };
  }

  /** Metrics carry their own format (integer by default): they are rarely in the headline's unit. */
  private metricText(m: HeroMetric): string {
    if (typeof m.value === 'number') return formatValue(m.value, m.format);
    return m.value ?? '—';
  }

  private model = (): TableModel => ({
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ],
    rows: [
      { metric: this.heading, value: `${this.valueText}${this.unit ?? ''}` },
      ...this.metrics.slice(0, 4).map((m) => ({ metric: m.label, value: this.metricText(m) })),
      ...(this.meter ? [{ metric: this.meter.label, value: formatValue(this.meter.value, { style: 'percent', decimals: 0 }) }] : []),
    ],
  });

  private renderBody(): VNode[] {
    const delta = this.deltaInfo;
    const metrics = this.metrics.slice(0, 4);
    const meter = this.meter;
    const on = meter ? Math.round(Math.max(0, Math.min(1, meter.value)) * TICKS) : 0;
    const pct = meter ? Math.round(meter.value * 100) : 0;
    return [
      <div key="top" class="hero-top">
        <div>
          <p class="hero-label">{this.heading}</p>
          <p class="hero-value" title={this.error}>
            {this.valueText}
            {this.unit && <span class="hero-unit">{this.unit}</span>}
          </p>
          {delta && (
            <p class="hero-delta" data-favourable={String(delta.favourable)}>
              {delta.text}
            </p>
          )}
        </div>
        {metrics.length > 0 && (
          <dl class="hero-metrics">
            {metrics.map((m, k) => (
              <div key={m.label} class="hero-metric" style={{ '--k': String(k) }}>
                <dt>{m.label}</dt>
                <dd>{this.metricText(m)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>,
      meter ? (
        <div key="meter" class="hero-meter">
          <div class="hero-ticks" role="meter" aria-label={meter.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={String(pct)}>
            {Array.from({ length: TICKS }, (_, i) => (
              <i key={i} data-on={i < on ? '' : undefined} />
            ))}
          </div>
          <div class="hero-meter__foot">
            <span>{meter.label}</span>
            <b>{`${pct}%`}</b>
          </div>
        </div>
      ) : null,
    ];
  }

  private renderFocus = () => {
    if (this.frame.view === 'table') {
      const m = this.model();
      return <univerus-data-table bare label={`${this.heading} (table)`} columns={m.columns} rows={m.rows} paginated={false} />;
    }
    return <div class="hero hero-focus">{this.renderBody()}</div>;
  };

  render() {
    const hasCurtain = Boolean(this.info || this.calc);
    const items: MenuItem[] = [
      ...(this.exportable ? exportItems(this, this.model) : []),
      ...(this.focusable ? [{ key: 'focus', label: 'Focus view', icon: UI_ICONS.focus, run: () => openFocus(this) }] : []),
    ];
    return (
      <Host data-theme={this.theme}>
        <div
          class="u-card u-card--pad u-curtain-host hero"
          style={{ '--i': String(this.index), opacity: this.stale ? '0.6' : undefined }}
          tabIndex={hasCurtain ? 0 : undefined}
          aria-describedby={hasCurtain ? 'curtain' : undefined}
        >
          {this.renderBody()}
          {hasCurtain && <Curtain info={this.info} calc={this.calc} />}
          {items.length > 0 && (
            <div class="hero-actions">
              <ActionMenu c={this} menuId="hero-menu" label={`More options for ${this.heading}`} icon={UI_ICONS.more} items={items} />
            </div>
          )}
          {this.focusable && <FocusDialog c={this} toggle render={this.renderFocus} />}
        </div>
      </Host>
    );
  }
}
