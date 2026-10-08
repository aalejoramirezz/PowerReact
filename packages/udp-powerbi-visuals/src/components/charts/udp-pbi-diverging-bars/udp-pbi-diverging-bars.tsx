import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive, type BarItem } from '../../../utils/data';
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
import { divergingRows } from '../../../utils/layout/bars';
import { formatSigned } from '../../../utils/layout/format';
import { barsTable, ROW_KEY } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';

/**
 * Diverging bars (Lens `diverging_bars`): signed values around a centre axis, most negative first.
 * Direction is carried by side, sign and the end labels — never by colour alone. With more rows
 * than `max-rows` the strongest ends of both sides are kept.
 */
@Component({
  tag: 'udp-pbi-diverging-bars',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-diverging-bars.css'],
  shadow: true,
})
export class UdpPbiDivergingBars {
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
  @Prop() loadingRows = 6;

  /** Categories with a signed value. */
  @Prop() data: BarItem[] = [];
  @Prop() negativeLabel = 'Negative';
  @Prop() positiveLabel = 'Positive';
  /** Max rows; with more members the strongest ends of both sides are kept. */
  @Prop() maxRows = 16;

  @State() ui: FrameState = INITIAL_FRAME;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private model = () => barsTable(this.data, this.format, { share: false });

  private renderChart = () => {
    const rows = divergingRows(this.data, this.maxRows);
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    return (
      <div role="group" aria-label={chartLabel(this)}>
        <div class="db-grid db-head" aria-hidden="true">
          <span />
          <span class="db-head__neg">{`← ${this.negativeLabel}`}</span>
          <span class="db-head__pos">{`${this.positiveLabel} →`}</span>
          <span />
        </div>
        <ul>
          {rows.map((row, k) => {
            const { datum } = row;
            const selected = sameValue(clickValue(datum), this.selectedValue);
            const body = [
              <span key="label" class="u-bar-label">{datum.label}</span>,
              <span key="neg" class="db-side db-side--neg">
                {row.side === 'negative' && <i class="db-bar db-bar--neg" style={{ width: `${row.ratio * 100}%` }} />}
              </span>,
              <span key="pos" class="db-side db-side--pos">
                {row.side === 'positive' && <i class="db-bar db-bar--pos" style={{ width: `${row.ratio * 100}%` }} />}
              </span>,
              <span key="value" class="u-bar-value">{formatSigned(datum.value, fmt)}</span>,
            ];
            const testId = this.testIdPrefix ? `${this.testIdPrefix}-bar-${datum.id}` : undefined;
            const dimmed = String(hasSelection && !selected);
            return (
              <li key={datum.id} class="u-row-enter" style={{ '--k': String(k) }}>
                {interactive ? (
                  <button
                    type="button"
                    class="u-row db-grid db-row"
                    data-dimmed={dimmed}
                    data-testid={testId}
                    aria-pressed={String(selected)}
                    onClick={() => emitClick(this, datum)}
                  >
                    {body}
                  </button>
                ) : (
                  <div class="u-row db-grid db-row" data-dimmed={dimmed} data-testid={testId}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
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
