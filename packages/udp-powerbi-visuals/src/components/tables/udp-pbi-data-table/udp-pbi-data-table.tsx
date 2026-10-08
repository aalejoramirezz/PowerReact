import { Component, Element, Event, h, Host, Prop, State, Watch, type EventEmitter, type VNode } from '@stencil/core';
import { CircleCheck } from 'lucide';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { Icon } from '../../../functional/icon';
import { MiniMeter } from '../../../functional/meter';
import { EmptyState, ErrorNote, LoadingState } from '../../../functional/states';
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
import type { FormatSpec } from '../../../utils/formats';
import { UI_ICONS } from '../../../utils/icons';
import {
  cellNumber,
  cellText,
  columnAlign,
  columnsFromRows,
  isNumericColumn,
  nextSort,
  PAGE_SIZES,
  paginate,
  sortRows,
  type SortState,
  type TableColumn,
  type TableModel,
  type TableRow,
} from '../../../utils/table/model';

const toValue = (v: unknown): DataPointValue | null =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : v === null || v === undefined ? null : String(v);

/**
 * "Which exact rows?" — precision over pattern (principle 19). Sortable headers (`aria-sort`),
 * 10 / 25 / 50-row pages, and below a 520 px container each row becomes a two-line list.
 * Rows are selectable (`aria-selected`, Enter / Space) and report the click as `dataPointClick`.
 *
 * Also the table view of every other visual (`frame="none"`: no card, no toolbar).
 */
@Component({
  tag: 'udp-pbi-data-table',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-data-table.css'],
  shadow: true,
})
export class UdpPbiDataTable {
  @Element() host!: HTMLElement;

  /* ── common visual props ── */
  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the table; defaults to the heading. */
  @Prop() label?: string;
  /** Curtain: what the data means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Default format of numeric columns without their own. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' rows shown (dimmed) while new ones load. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** Selected row (its `rowKey` value). */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference a row click filters, e.g. 'asset_class'[Asset_Class]. */
  @Prop() crossFilterField?: string;
  /** Rows are selectable and emit `dataPointClick` (default: when `crossFilterField` is set). */
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the table shown. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  /**
   * card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone,
   * to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged.
   */
  @Prop() frame: VisualFrameMode = 'card';
  /** `data-testid` prefix: `${prefix}-row-${key}` on each row. */
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /* ── table props ── */
  /** Columns; inferred from the rows when empty. */
  @Prop() columns: TableColumn[] = [];
  @Prop() rows: TableRow[] = [];
  /** Field identifying a row (selection, click value). Default: the first column. */
  @Prop() rowKey?: string;
  @Prop() sortable = true;
  @Prop() paginated = true;
  @Prop() pageSize = 10;
  /** Max height of the scroll area in px (sticky header); none by default. */
  @Prop() maxHeight?: number;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() sort: SortState | null = null;
  @State() page = 0;
  @State() size = 10;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  @Watch('pageSize')
  pageSizeChanged(next: number): void {
    this.size = next;
    this.page = 0;
  }

  @Watch('rows')
  rowsChanged(): void {
    this.page = 0;
  }

  componentWillLoad(): void {
    this.size = this.pageSize;
  }

  private get effectiveColumns(): TableColumn[] {
    const columns = this.columns.length ? this.columns : columnsFromRows(this.rows);
    return this.format ? columns.map((c) => (isNumericColumn(c) && !c.format ? { ...c, format: this.format } : c)) : columns;
  }

  private get keyField(): string | undefined {
    return this.rowKey ?? this.effectiveColumns[0]?.key;
  }

  private get isInteractive(): boolean {
    return this.interactive ?? Boolean(this.crossFilterField);
  }

  private model = (): TableModel => ({ columns: this.effectiveColumns, rows: this.rows });

  private select(row: TableRow, columns: TableColumn[]): void {
    const key = this.keyField;
    if (!key) return;
    const labelColumn = columns.find((c) => !isNumericColumn(c)) ?? columns[0];
    this.dataPointClick.emit({
      visualId: this.visualId ?? null,
      field: this.crossFilterField ?? null,
      value: toValue(row[key]),
      label: labelColumn ? cellText(row, labelColumn) : String(row[key] ?? ''),
    });
  }

  private renderCell(row: TableRow, column: TableColumn, first: boolean, selected: boolean): VNode {
    const end = columnAlign(column) === 'end';
    const text = cellText(row, column);
    const cls = { 'is-end': end, 'u-num': column.kind === 'number' };
    switch (column.kind) {
      case 'number':
        return (
          <td role="cell" class={cls}>
            <span class="u-cell-strong">{text}</span>
          </td>
        );
      case 'meter': {
        const ratio = column.ratioKey ? (cellNumber(row[column.ratioKey]) ?? 0) : 0;
        return (
          <td role="cell" class={cls}>
            <span class="u-cell-end u-cell-meter">
              <span class="u-num">{text}</span>
              <MiniMeter value={ratio} class="u-cell-meter__bar" />
              <span class="u-num u-cell-pct">{`${Math.round(ratio * 100)}%`}</span>
            </span>
          </td>
        );
      }
      case 'status': {
        const n = cellNumber(row[column.key]) ?? 0;
        return (
          <td role="cell" class={cls}>
            {n > 0 ? (
              <span class="u-chip u-num" data-tone={column.tone ?? 'warn'}>
                {column.suffix ? `${text} ${column.suffix}` : text}
              </span>
            ) : (
              <span class="u-cell-muted" aria-label={column.emptyLabel}>
                —
              </span>
            )}
          </td>
        );
      }
      default:
        return (
          <td role="cell" class={cls}>
            {first ? (
              <span class="u-cell-name">
                {selected && <Icon node={CircleCheck} size={14} class="u-cell-check" />}
                <span>{text}</span>
              </span>
            ) : (
              text
            )}
          </td>
        );
    }
  }

  private renderHeader(column: TableColumn): VNode {
    const end = columnAlign(column) === 'end';
    const canSort = this.sortable && column.sortable !== false;
    const active = this.sort?.key === column.key ? this.sort : null;
    const ariaSort = canSort ? (active ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
    return (
      <th role="columnheader" class={{ 'is-end': end }} aria-sort={ariaSort} scope="col">
        {canSort ? (
          <button type="button" class="u-th-sort" onClick={() => (this.sort = nextSort(this.sort, column))}>
            {column.label}
            <Icon node={active ? (active.dir === 'asc' ? UI_ICONS.sortAsc : UI_ICONS.sortDesc) : UI_ICONS.sortNone} size={11} strokeWidth={2.2} />
          </button>
        ) : (
          column.label
        )}
      </th>
    );
  }

  private fullWidthRow(span: number, content: VNode): VNode {
    return (
      <tr role="row">
        <td role="cell" colSpan={span} class="u-cell-full">
          {content}
        </td>
      </tr>
    );
  }

  /** The table itself, with its states inside the body so the header keeps its place. */
  private renderTable(inDialog: boolean): VNode[] {
    const columns = this.effectiveColumns;
    const key = this.keyField;
    const interactive = this.isInteractive;
    const sorted = sortRows(this.rows, this.sort, columns);
    const page = this.paginated ? paginate(sorted, this.page, this.size) : null;
    const shown = page ? page.rows : sorted;
    const span = Math.max(1, columns.length);
    const maxHeight = !inDialog && this.maxHeight ? `${this.maxHeight}px` : undefined;

    let body: VNode | VNode[];
    if (this.rows.length === 0) {
      body = this.fullWidthRow(
        span,
        this.error ? <ErrorNote message={this.error} /> : this.loading ? <LoadingState rows={this.loadingRows} /> : <EmptyState message={this.emptyMessage} />
      );
    } else {
      body = shown.map((row) => {
        const value = key ? toValue(row[key]) : null;
        const selected = interactive && sameValue(value, this.selectedValue);
        const activate = () => this.select(row, columns);
        return (
          <tr
            role="row"
            key={String(value)}
            data-testid={this.testIdPrefix && value !== null ? `${this.testIdPrefix}-row-${value}` : undefined}
            data-interactive={interactive ? 'true' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-selected={interactive ? String(selected) : undefined}
            onClick={interactive ? activate : undefined}
            onKeyDown={
              interactive
                ? (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      activate();
                    }
                  }
                : undefined
            }
          >
            {columns.map((column, i) => this.renderCell(row, column, i === 0, selected))}
          </tr>
        );
      });
    }

    const out: VNode[] = [];
    if (this.error && this.rows.length > 0) out.push(<ErrorNote message={this.error} />);
    out.push(
      <div class="u-table-wrap" style={{ maxHeight }} data-stale={String(this.stale)}>
        <table class="u-table u-table--stack" role="table" aria-label={this.label || this.heading || 'Data table'}>
          <thead>
            <tr role="row">{columns.map((c) => this.renderHeader(c))}</tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    );
    if (page && page.total > PAGE_SIZES[0]) {
      out.push(
        <div class="u-pager">
          <span class="u-num" aria-live="polite">{`${page.first}–${page.last} of ${page.total}`}</span>
          <div class="u-pager__nav">
            <label class="u-pager__size">
              Rows
              <select
                class="u-select"
                aria-label="Rows per page"
                onChange={(e: Event) => {
                  this.size = Number((e.target as HTMLSelectElement).value);
                  this.page = 0;
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={String(n)} selected={n === this.size}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" class="u-icon-btn" aria-label="Previous page" disabled={page.page === 0} onClick={() => (this.page = page.page - 1)}>
              <Icon node={UI_ICONS.prev} size={16} />
            </button>
            <button
              type="button"
              class="u-icon-btn"
              aria-label="Next page"
              disabled={page.page >= page.pageCount - 1}
              onClick={() => (this.page = page.page + 1)}
            >
              <Icon node={UI_ICONS.next} size={16} />
            </button>
          </div>
        </div>
      );
    }
    return out;
  }

  render() {
    if (this.frame === 'none') {
      return <Host data-theme={this.theme}>{this.renderTable(false)}</Host>;
    }
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          // The table draws its own loading / empty / error rows under the header
          ownStates
          hasData={this.rows.length > 0}
          renderChart={() => this.renderTable(this.ui.focusOpen)}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
