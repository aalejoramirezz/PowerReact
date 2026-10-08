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
import { rankedRows } from '../../../utils/layout/bars';
import { barsTable, ROW_KEY } from '../../../utils/table/builders';
import type { TableRow } from '../../../utils/table/model';

/**
 * Compact ranking (Lens `ranking_bars`): name · quiet track with the gradient fill · value, one line
 * per category, sorted high → low. Use it when space is tight; spotlight bars when shares matter.
 * A bottom-N list (`order="asc"`) stays relative to the overall leader.
 */
@Component({
  tag: 'udp-pbi-ranking-bars',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', '../../../styles/charts.css', 'udp-pbi-ranking-bars.css'],
  shadow: true,
})
export class UdpPbiRankingBars {
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
  /** Column reference a click filters, e.g. 'asset_class'[Asset_Class]. */
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

  /** Categories with their value. */
  @Prop() data: BarItem[] = [];
  /** Rows shown (0 = all); a note says how many are hidden. */
  @Prop() topN = 8;
  /** `asc` lists the bottom N. */
  @Prop() order: 'desc' | 'asc' = 'desc';
  /** bar: the slim pill bar; lollipop: a hairline ending in a dot (FT lollipop, lighter for long lists). */
  @Prop() mark: 'bar' | 'lollipop' = 'bar';

  @State() ui: FrameState = INITIAL_FRAME;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private model = () => barsTable(this.data, this.format, { share: false });

  private renderChart = () => {
    const { rows, hidden } = rankedRows(this.data, { topN: this.topN, order: this.order });
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    return [
      <ul key="list" aria-label={chartLabel(this)}>
        {rows.map((row, k) => {
          const selected = sameValue(clickValue(row.datum), this.selectedValue);
          const body = [
            <span key="label" class="u-bar-label">{row.datum.label}</span>,
            <span key="track" class="u-bar-track" data-mark={this.mark}>
              <span class="u-bar-fill" style={{ width: `${row.ratio * 100}%` }} />
            </span>,
            <span key="value" class="u-bar-value">{fmt(row.datum.value)}</span>,
          ];
          const testId = this.testIdPrefix ? `${this.testIdPrefix}-bar-${row.datum.id}` : undefined;
          const dimmed = String(hasSelection && !selected);
          return (
            <li key={row.datum.id} class="u-row-enter" style={{ '--k': String(k) }}>
              {interactive ? (
                <button
                  type="button"
                  class="u-row rb-row"
                  data-dimmed={dimmed}
                  data-testid={testId}
                  aria-pressed={String(selected)}
                  onClick={() => emitClick(this, row.datum)}
                >
                  {body}
                </button>
              ) : (
                <div class="u-row rb-row" data-dimmed={dimmed} data-testid={testId}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>,
      hidden > 0 ? <p key="note" class="u-note">{`Top ${rows.length} of ${rows.length + hidden}`}</p> : null,
    ];
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
