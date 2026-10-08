import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive, type BulletItem } from '../../../utils/data';
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
import { bulletRows } from '../../../utils/layout/bars';
import { formatSigned } from '../../../utils/layout/format';
import { bulletTable, ROW_KEY } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';

const VARIANCE: FormatSpec = { style: 'percent', decimals: 1 };

/**
 * Comparison (bullet) bars (Lens `bullet_bars`): fill = actual, tick = target on a shared scale,
 * and a variance chip coloured by whether the gap is good (`good-when`) — never by its sign alone.
 */
@Component({
  tag: 'udp-pbi-bullet-bars',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-bullet-bars.css'],
  shadow: true,
})
export class UdpPbiBulletBars {
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
  /** The selected category's value; the other rows dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a click filters. */
  @Prop() crossFilterField?: string;
  /** Rows are toggle buttons that emit `dataPointClick` (default: when `crossFilterField` is set). */
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
  /** `data-testid` prefix: `${prefix}-bar-${id}` on each row. */
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** Categories with actual and target. */
  @Prop() data: BulletItem[] = [];
  /** `above`: at or over target is favourable (scores); `below`: under target is (response time). */
  @Prop() goodWhen: 'above' | 'below' = 'above';
  @Prop() topN = 8;
  /** Name of the target in tooltips, the table and the export. */
  @Prop() targetLabel = 'Target';

  @State() ui: FrameState = INITIAL_FRAME;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private model = () => bulletTable(this.data, this.format, this.targetLabel);

  private renderChart = () => {
    const rows = bulletRows(this.data, { goodWhen: this.goodWhen, topN: this.topN });
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    return (
      <ul aria-label={chartLabel(this)}>
        {rows.map((row, k) => {
          const { datum } = row;
          const selected = sameValue(clickValue(datum), this.selectedValue);
          const body = [
            <span key="label" class="u-bar-label">{datum.label}</span>,
            <span key="track" class="bb-track">
              <span class="u-bar-fill" style={{ width: `${row.actualRatio * 100}%`, boxShadow: 'none' }} />
              {row.targetRatio !== null && (
                <span class="bb-target" style={{ left: `${row.targetRatio * 100}%` }} title={`${this.targetLabel}: ${fmt(datum.target ?? 0)}`} />
              )}
            </span>,
            <span key="value" class="u-bar-value bb-value">{fmt(datum.actual)}</span>,
            <span key="variance" class="bb-variance">
              {row.variance === null ? (
                <span class="bb-none">—</span>
              ) : (
                <span class="u-chip u-num" data-tone={row.favourable ? 'ok' : 'bad'}>
                  {formatSigned(row.variance, (v) => formatValue(v, VARIANCE))}
                </span>
              )}
            </span>,
          ];
          const testId = this.testIdPrefix ? `${this.testIdPrefix}-bar-${datum.id}` : undefined;
          const dimmed = String(hasSelection && !selected);
          return (
            <li key={datum.id} class="u-row-enter" style={{ '--k': String(k) }}>
              {interactive ? (
                <button
                  type="button"
                  class="u-row bb-row"
                  data-dimmed={dimmed}
                  data-testid={testId}
                  aria-pressed={String(selected)}
                  onClick={() => emitClick(this, datum)}
                >
                  {body}
                </button>
              ) : (
                <div class="u-row bb-row" data-dimmed={dimmed} data-testid={testId}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
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
