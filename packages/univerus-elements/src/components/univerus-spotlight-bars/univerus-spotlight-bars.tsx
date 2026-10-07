import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, VisualFrame, type FrameState } from '../../functional/frame';
import { chartLabel, clickValue, emitClick, isInteractive, type BarItem } from '../../utils/data';
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
import { formatter, formatValue, type FormatSpec } from '../../utils/formats';
import { rankedRows } from '../../utils/layout/bars';
import { barsTable, ROW_KEY } from '../../utils/table/builders';
import type { TableRow } from '../../utils/table/model';

const SHARE: FormatSpec = { style: 'percent', decimals: 1 };

/**
 * Spotlight bars (Lens `spotlight_bars`): the category above a slim pill bar on a full-width track,
 * the value at the end, its share of the total beside it and an optional rank. The answer to
 * "which category leads?" that can also filter the page; unselected rows recede when one is picked.
 * Shares are computed over every category received, never over the rows left after top N.
 */
@Component({
  tag: 'univerus-spotlight-bars',
  styleUrls: ['../../styles/motion.css', '../../styles/shadow.css', '../../styles/surfaces.css', '../../styles/charts.css', 'univerus-spotlight-bars.css'],
  shadow: true,
})
export class UniverusSpotlightBars {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the list; defaults to the heading. */
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
  /** Column reference a click filters, e.g. 'asset_class_group'[Asset_Class_Group]. */
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
  /** `data-testid` prefix: `${prefix}-bar-${id}` on the row, `${prefix}-share-${id}` on the share. */
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 4;

  /** Categories with their value and optional `meta` (a quiet line under the bar). */
  @Prop() data: BarItem[] = [];
  /** Figure beside the value: share of the total, the share in parentheses, or nothing. */
  @Prop() secondary: 'share' | 'share-paren' | 'none' = 'share';
  /** Rows shown (0 = all). */
  @Prop() topN = 0;
  /** Prefix "#n" to each label. */
  @Prop() rank = false;
  /** Chip on the selected row, e.g. "Cross-Filtered". */
  @Prop() selectedBadge?: string;

  @State() frame: FrameState = INITIAL_FRAME;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private model = () => barsTable(this.data, this.format);

  private renderChart = () => {
    const { rows } = rankedRows(this.data, { topN: this.topN });
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const p = this.testIdPrefix;

    return (
      <ul class="sb-list" aria-label={chartLabel(this)}>
        {rows.map((row) => {
          const { datum } = row;
          const selected = sameValue(clickValue(datum), this.selectedValue);
          const share = formatValue(row.share, SHARE);
          const body = [
            <span key="line" class="sb-line">
              <span class="sb-name">
                {this.rank && <span class="sb-rank">{`#${row.rank}`}</span>}
                <span class="sb-label">{datum.label}</span>
                {selected && this.selectedBadge && (
                  <span class="u-chip" data-tone="accent">
                    {this.selectedBadge}
                  </span>
                )}
              </span>
              <span class="sb-figures">
                {this.secondary !== 'none' && (
                  <span class="sb-share" data-testid={p ? `${p}-share-${datum.id}` : undefined}>
                    {this.secondary === 'share-paren' ? `(${share})` : share}
                  </span>
                )}
                <span class="sb-value">{fmt(datum.value)}</span>
              </span>
            </span>,
            <span key="track" class="u-bar-track">
              <span class="u-bar-fill" style={{ width: `${row.ratio * 100}%` }} />
            </span>,
            datum.meta?.length ? (
              <span key="meta" class="sb-meta">
                {datum.meta.map((m) => (
                  <span key={m.label}>
                    {`${m.label} `}
                    <b data-tone={m.tone}>{m.value}</b>
                    {m.note ? ` ${m.note}` : ''}
                  </span>
                ))}
              </span>
            ) : null,
          ];
          const testId = p ? `${p}-bar-${datum.id}` : undefined;
          const dimmed = String(hasSelection && !selected);
          return (
            <li key={datum.id} class="u-row-enter" style={{ '--k': String(row.rank - 1) }}>
              {interactive ? (
                <button
                  type="button"
                  class="u-row sb-row"
                  data-dimmed={dimmed}
                  data-selected={String(selected)}
                  data-testid={testId}
                  aria-pressed={String(selected)}
                  onClick={() => emitClick(this, datum)}
                >
                  {body}
                </button>
              ) : (
                <div class="u-row sb-row" data-dimmed={dimmed} data-selected={String(selected)} data-testid={testId}>
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
