import { Build, Component, Element, Event, h, Host, Prop, State, Watch, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive, type DonutItem } from '../../../utils/data';
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
import { formatter, formatValue, type FormatSpec } from '../../../utils/formats';
import { donutLayout } from '../../../utils/layout/donut';
import { donutTable, ROW_KEY } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';

const SHARE: FormatSpec = { style: 'percent', decimals: 0 };
const OTHER_ID = '__other__';

/**
 * Donut for simple composition (principle 17; Lens native donut / dark mockup): total in the hole,
 * legend list with share and value, largest part first in the strongest colour. More than six parts
 * is a ranking: the tail folds into "Other" (and a dev warning says to use spotlight bars).
 */
@Component({
  tag: 'udp-pbi-donut',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-donut.css'],
  shadow: true,
})
export class UdpPbiDonut {
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
  /** The selected part's value; the other parts dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click filters. */
  @Prop() crossFilterField?: string;
  /** Segments and legend rows emit `dataPointClick` (default: when `crossFilterField` is set). */
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
  /** `data-testid` prefix: `${prefix}-part-${id}` on each legend row. */
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 4;

  /** The parts of a real total (2–6). */
  @Prop() data: DonutItem[] = [];
  /** Unit under the centre number, e.g. "requests". */
  @Prop() centerLabel = 'total';
  /** Diameter in px. */
  @Prop() size = 164;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() hoverId: string | null = null;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  @Watch('data')
  warnWhenCrowded(): void {
    if (!Build.isDev) return;
    const { collapsed } = donutLayout(this.data, 1);
    if (collapsed > 0) {
      console.warn(`[udp-pbi-donut] "${chartLabel(this)}": ${collapsed} categories folded into "Other". A composition with more than six parts is a ranking (udp-pbi-spotlight-bars).`);
    }
  }

  componentWillLoad(): void {
    this.warnWhenCrowded();
  }

  private model = () => donutTable(this.data, this.format);

  private renderChart = () => {
    const size = this.size;
    const stroke = Math.round(size * 0.13);
    const r = (size - stroke) / 2;
    const c = size / 2;
    const layout = donutLayout(this.data, r);
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const byId = new Map(this.data.map((d) => [d.id, d]));
    const selectedId = layout.segments.find((s) => {
      const d = byId.get(s.id);
      return d ? sameValue(clickValue(d), this.selectedValue) : false;
    })?.id;
    const focusId = this.hoverId ?? selectedId ?? null;
    const focused = layout.segments.find((s) => s.id === focusId);
    const select = (id: string) => {
      const d = byId.get(id);
      if (d && interactive) emitClick(this, d);
    };

    return (
      <div class="dn">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={chartLabel(this)}>
          <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: 'var(--pbi-track)' }} stroke-width={stroke} />
          <g transform={`rotate(-90 ${c} ${c})`}>
            {layout.segments.map((s, i) => (
              <circle
                key={s.id}
                class="dn-seg"
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke-width={stroke}
                stroke-dasharray={`${s.length} ${layout.circumference}`}
                stroke-dashoffset={s.offset}
                data-dimmed={String(Boolean(focusId) && focusId !== s.id)}
                data-interactive={String(interactive && s.id !== OTHER_ID)}
                style={{ stroke: `var(--pbi-series-${s.slot})`, animation: `u-seg 1.2s var(--pbi-ease) ${0.2 + i * 0.15}s both` }}
                onMouseEnter={() => (this.hoverId = s.id)}
                onMouseLeave={() => (this.hoverId = null)}
                onClick={() => select(s.id)}
              />
            ))}
          </g>
          <text
            x={c}
            y={c + 4}
            text-anchor="middle"
            style={{ font: '600 26px var(--pbi-font-display)', fill: 'var(--pbi-title)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
          >
            {fmt(focused ? focused.value : layout.total)}
          </text>
          <text x={c} y={c + 24} text-anchor="middle" style={{ font: '500 11px var(--pbi-font-body)', fill: 'var(--pbi-label)' }}>
            {focused ? formatValue(focused.share, SHARE) : this.centerLabel}
          </text>
        </svg>

        <ul class="dn-legend" aria-label={`${chartLabel(this)} legend`}>
          {layout.segments.map((s, k) => {
            const datum = byId.get(s.id);
            const content = [
              <span key="name" class="dn-name">
                <i class="dn-swatch" style={{ background: `var(--pbi-series-${s.slot})` }} />
                <span>{s.label}</span>
              </span>,
              <span key="share" class="dn-share">{formatValue(s.share, SHARE)}</span>,
              <b key="value" class="dn-value">{fmt(s.value)}</b>,
            ];
            const dimmed = String(Boolean(focusId) && focusId !== s.id);
            const testId = this.testIdPrefix ? `${this.testIdPrefix}-part-${s.id}` : undefined;
            return (
              <li key={s.id} style={{ '--k': String(k) }} onMouseEnter={() => (this.hoverId = s.id)} onMouseLeave={() => (this.hoverId = null)}>
                {interactive && datum ? (
                  <button
                    type="button"
                    class="dn-row"
                    data-dimmed={dimmed}
                    data-testid={testId}
                    aria-pressed={String(selectedId === s.id)}
                    onClick={() => select(s.id)}
                  >
                    {content}
                  </button>
                ) : (
                  <div class="dn-row" data-dimmed={dimmed} data-testid={testId}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
          {layout.collapsed > 0 && (
            <li class="u-note">{`${layout.collapsed} smaller categories grouped as “Other”. With more than six parts, use a ranking.`}</li>
          )}
        </ul>
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
