import { Component, Element, Event, h, Host, Prop, State, type EventEmitter, type VNode } from '@stencil/core';
import { ActionMenu, Curtain, exportItems, FocusDialog, INITIAL_FRAME, openFocus, type FrameState, type MenuItem } from '../../../functional/frame';
import { Icon } from '../../../functional/icon';
import { MiniMeter } from '../../../functional/meter';
import { slug } from '../../../utils/data';
import type {
  DataPointClickDetail,
  ExportDetail,
  ExportFormat,
  FocusModeDetail,
  ThemeName,
  ViewChangeDetail,
} from '../../../utils/events';
import { formatValue, type FormatSpec } from '../../../utils/formats';
import { isKpiIconName, KPI_ICONS, UI_ICONS } from '../../../utils/icons';
import type { ChipTone, TableModel, TableRow } from '../../../utils/table/model';

export interface KpiDelta {
  text: string;
  /** Colour follows business meaning (favourable / unfavourable), never the sign alone. */
  favourable: boolean;
}

export interface KpiBadge {
  text: string;
  tone?: ChipTone;
  /** Extra words shown only when the report is wide enough, e.g. "of assets". */
  detail?: string;
}

export interface KpiMeter {
  /** 0..1 */
  value: number;
  /** Accessible name; the meter is decorative without one. */
  label?: string;
  /** Extra words after the percentage on wider reports, e.g. "of assets". */
  detail?: string;
}

const PCT1: FormatSpec = { style: 'percent', decimals: 1 };

/**
 * KPI card (Lens `kpi_card`): uppercase label, tinted icon mark, the number as the dominant element,
 * a delta / badge / meter. "What it means / how it is calculated" lives one hover (or keyboard focus)
 * away in the curtain (principle 35), never on the card face.
 *
 * The card is a frame holding sibling buttons, never nested ones: the content (a full-card button
 * when the KPI is interactive), on touch screens an ⓘ that toggles the same curtain, and the ⋯ menu
 * (export, focus view). Test ids: `kpi-<label-slug>` on the number, `kpi-card-<label-slug>` on the card.
 */
@Component({
  tag: 'udp-pbi-kpi-card',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-kpi-card.css'],
  shadow: true,
})
export class UdpPbiKpiCard {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** The KPI label (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  /** Curtain: what the number means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Format of `value` (and of the comparison). */
  @Prop() format?: FormatSpec;
  /** Shows "…" until the first value arrives. */
  @Prop() loading = false;
  /** Shows "—"; the message goes to the number's tooltip. */
  @Prop() error?: string;
  /** Previous filters' value shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  /** Column reference a click filters (reported in `dataPointClick`). */
  @Prop() crossFilterField?: string;
  /** The card is a button that emits `dataPointClick` (default: when `active` or `crossFilterField` is set). */
  @Prop() interactive?: boolean;
  /** Toggle state; leave undefined for a plain action (no pressed state, no selection ring). */
  @Prop() active?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the KPI's own table. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  /** Entrance stagger position. */
  @Prop() index = 0;

  /** The number. */
  @Prop() value?: number | null;
  /** Already formatted text; wins over `value` (e.g. "2.4h"). */
  @Prop() displayValue?: string;
  /** Quiet words beside the number, e.g. "in register", "Years". */
  @Prop() caption?: string;
  /** Explicit delta; otherwise it is derived from `comparison-value`. */
  @Prop() delta?: KpiDelta;
  /** Reference value (PY, plan…) the delta is computed against. */
  @Prop() comparisonValue?: number | null;
  /** Whether a higher value is favourable (colours the derived delta). */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** Suffix of the derived delta, e.g. "vs PY". */
  @Prop() deltaLabel?: string;
  /** Status chip beside the number. */
  @Prop() badge?: KpiBadge;
  /** Thin meter under the number (0..1) with its percentage. */
  @Prop() meter?: KpiMeter;
  /** Icon mark by name (`database`, `check-circle`, `alert-triangle`, …); or use the `icon` slot. */
  @Prop() icon?: string;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() touchOpen = false;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private get valueText(): string {
    if (this.displayValue !== undefined && this.displayValue !== null) return this.displayValue;
    if (this.value === null || this.value === undefined) return this.loading && !this.error ? '…' : '—';
    return formatValue(this.value, this.format);
  }

  private get deltaInfo(): KpiDelta | null {
    if (this.delta) return this.delta;
    const v = this.value;
    const c = this.comparisonValue;
    if (v === null || v === undefined || c === null || c === undefined || c === 0) return null;
    const change = (v - c) / Math.abs(c);
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const favourable = this.goodWhen === 'higher' ? change >= 0 : change <= 0;
    return { text: `${arrow} ${formatValue(Math.abs(change), PCT1)}${this.deltaLabel ? ` ${this.deltaLabel}` : ''}`, favourable };
  }

  private get isInteractive(): boolean {
    return this.interactive ?? (this.active !== undefined || Boolean(this.crossFilterField));
  }

  private model = (): TableModel => ({
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value', kind: typeof this.value === 'number' ? 'number' : 'text', format: this.format },
      ...(this.comparisonValue !== undefined && this.comparisonValue !== null
        ? [{ key: 'comparison', label: 'Comparison', kind: 'number' as const, format: this.format }]
        : []),
    ],
    rows: [{ metric: this.heading, value: this.value ?? this.displayValue ?? null, comparison: this.comparisonValue ?? null }],
  });

  private onActivate = () => {
    this.dataPointClick.emit({
      visualId: this.visualId ?? null,
      field: this.crossFilterField ?? null,
      value: this.visualId ?? this.heading,
      label: this.heading,
    });
  };

  private renderAside(inFocus = false): VNode[] {
    const delta = this.deltaInfo;
    const out: VNode[] = [];
    if (delta) {
      out.push(
        <span class="kpi-delta" data-favourable={String(delta.favourable)}>
          {delta.text}
        </span>
      );
    }
    if (this.badge) {
      out.push(
        <span class="u-chip u-num" data-tone={this.badge.tone}>
          {this.badge.text}
          {this.badge.detail && <span class="kpi-detail">{this.badge.detail}</span>}
        </span>
      );
    }
    if (this.caption) out.push(<span class={inFocus ? 'kpi-focus__caption' : 'kpi-caption'}>{this.caption}</span>);
    return out;
  }

  private renderMeter(): VNode | null {
    const m = this.meter;
    if (!m) return null;
    return (
      <span class="kpi-meter">
        <MiniMeter value={m.value} label={m.label} />
        <span class="kpi-meter__text">
          {this.value === undefined && this.loading ? '…' : formatValue(m.value, PCT1)}
          {m.detail && <span class="kpi-detail">{` ${m.detail}`}</span>}
        </span>
      </span>
    );
  }

  /** Focus view: the number large, its context and its definition; or the table. */
  private renderFocus = () => {
    if (this.ui.view === 'table') {
      const m = this.model();
      return <udp-pbi-data-table frame="none" label={`${this.heading} (table)`} columns={m.columns} rows={m.rows} paginated={false} />;
    }
    return (
      <div class="kpi-focus">
        <p class="kpi-focus__label">{this.heading}</p>
        <p class="kpi-focus__value">{this.valueText}</p>
        <div class="kpi-focus__row">{this.renderAside(true)}</div>
        {this.renderMeter()}
        {this.info && <p class="kpi-focus__info">{this.info}</p>}
        {this.calc && (
          <p class="kpi-focus__calc">
            <b aria-hidden="true">ƒ</b>
            {this.calc}
          </p>
        )}
      </div>
    );
  };

  render() {
    const id = slug(this.heading);
    const hasCurtain = Boolean(this.info || this.calc);
    const interactive = this.isInteractive;
    const iconNode = isKpiIconName(this.icon) ? KPI_ICONS[this.icon] : null;
    const items: MenuItem[] = [
      ...(this.exportable ? exportItems(this, this.model) : []),
      ...(this.focusable ? [{ key: 'focus', label: 'Focus view', icon: UI_ICONS.focus, run: () => openFocus(this) }] : []),
    ];

    const content = [
      <div key="top" class="kpi-top">
        <span class="kpi-label">{this.heading}</span>
        <slot name="icon">
          {iconNode && (
            <span class="kpi-mark" aria-hidden="true">
              <Icon node={iconNode} size={16} strokeWidth={1.8} />
            </span>
          )}
        </slot>
      </div>,
      <div key="main" class="kpi-main" data-stale={String(this.stale)}>
        <span class="kpi-value" data-testid={`kpi-${id}`} title={this.error}>
          {this.valueText}
        </span>
        <span class="kpi-aside">
          <slot name="aside">{this.renderAside()}</slot>
        </span>
      </div>,
      this.renderMeter(),
      <slot key="footer" name="footer" />,
    ];

    return (
      <Host data-theme={this.theme}>
        <div
          class={{
            'u-card': true,
            'u-curtain-host': true,
            kpi: true,
            'kpi--curtain': hasCurtain,
            'kpi--actions': items.length > 0,
            'u-card--interactive': interactive,
            'u-card--active': this.active === true,
          }}
          style={{ '--i': String(this.index) }}
          data-testid={`kpi-card-${id}`}
        >
          {interactive ? (
            <button
              type="button"
              class="kpi-body"
              aria-pressed={this.active === undefined ? undefined : String(this.active)}
              aria-describedby={hasCurtain ? 'curtain' : undefined}
              onClick={this.onActivate}
            >
              {content}
            </button>
          ) : (
            // Focusable so keyboard users can reveal the curtain too
            <div class="kpi-body" tabIndex={hasCurtain ? 0 : undefined} aria-describedby={hasCurtain ? 'curtain' : undefined}>
              {content}
            </div>
          )}

          {hasCurtain && (
            <button
              type="button"
              class="u-icon-btn kpi-info"
              aria-expanded={String(this.touchOpen)}
              aria-controls="curtain"
              aria-label={this.touchOpen ? `Hide what ${this.heading} means` : `What ${this.heading} means`}
              onClick={() => (this.touchOpen = !this.touchOpen)}
            >
              <Icon node={UI_ICONS.info} size={16} />
            </button>
          )}
          {hasCurtain && <Curtain info={this.info} calc={this.calc} open={this.touchOpen} onClose={() => (this.touchOpen = false)} padding="var(--pbi-kpi-pad)" />}

          {items.length > 0 && (
            <div class="kpi-actions">
              <ActionMenu c={this} menuId="kpi-menu" label={`More options for ${this.heading}`} icon={UI_ICONS.more} items={items} />
            </div>
          )}
          {this.focusable && <FocusDialog c={this} toggle render={this.renderFocus} />}
        </div>
      </Host>
    );
  }
}
