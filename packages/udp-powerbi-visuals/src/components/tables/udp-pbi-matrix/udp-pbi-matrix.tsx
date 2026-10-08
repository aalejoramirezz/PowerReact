import { Component, Element, Event, h, Host, Prop, State, Watch, type EventEmitter } from '@stencil/core';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { Icon } from '../../../functional/icon';
import { chartLabel, clickValue } from '../../../utils/data';
import {
  sameValue,
  type DataPointClickDetail,
  type DataPointFilter,
  type DataPointValue,
  type ExportDetail,
  type ExportFormat,
  type FocusModeDetail,
  type ThemeName,
  type ViewChangeDetail,
} from '../../../utils/events';
import { formatter, type FormatSpec } from '../../../utils/formats';
import { UI_ICONS } from '../../../utils/icons';
import {
  heatScales,
  initialExpanded,
  matrixTable,
  visibleRows,
  type MatrixColumn,
  type MatrixMeasure,
  type MatrixNode,
  type VisibleRow,
} from '../../../utils/layout/matrix';
import type { TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

/** Pivot geometry: equal value columns (uniform heat tiles), scrolling inside the card when narrow. */
const ROW_HEADER_PX = 150;
const VALUE_COLUMN_PX = 64;

interface Cell {
  r: number;
  c: number;
}

/** A value column of the grid: a column member × measure, or a row total of a measure. */
interface ValueColumn {
  measure: MatrixMeasure;
  /** Index in `columns`; null for the total column (or the single column without a pivot). */
  column: number | null;
  total: boolean;
}

/**
 * Matrix (Lens matrix; FT XY heatmap, e.g. the criticality × condition risk matrix): hierarchical
 * rows (1–3 levels, expand / collapse), an optional column dimension and several measures, each
 * optionally heat-mapped with a token ramp (sequential, or diverging by business meaning). Totals
 * and subtotals are passed in from the engine, never summed here. A WAI-ARIA treegrid: one tab stop,
 * arrows move between cells, → / ← expand and collapse, Enter / Space select. A click on a cell
 * reports its row and column (`filters`), on a row header its row.
 */
@Component({
  tag: 'udp-pbi-matrix',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-matrix.css'],
  shadow: true,
})
export class UdpPbiMatrix {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the grid; defaults to the heading. */
  @Prop() label?: string;
  /** Curtain: what the matrix means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Default format of the measures (each measure may set its own). */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected row (raw value or id, at any level). */
  @Prop() selectedValue?: DataPointValue | null;
  /** The selected column member (raw value or id). */
  @Prop() selectedColumn?: DataPointValue | null;
  /** Column reference of the top row level (shorthand for `rowFields[0]`). */
  @Prop() crossFilterField?: string;
  /** Column reference per row level, top first: a click on a row filters its own level. */
  @Prop() rowFields: string[] = [];
  /** Column reference of the column dimension: a click on a cell also filters it. */
  @Prop() columnField?: string;
  /** Clicks emit `dataPointClick` (default: when a field is set). */
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the flattened matrix. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  /**
   * card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone,
   * to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged.
   */
  @Prop() frame: VisualFrameMode = 'card';
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** The row tree. */
  @Prop() nodes: MatrixNode[] = [];
  /** Members of the column dimension (none: one column per measure). */
  @Prop() columns: MatrixColumn[] = [];
  @Prop() measures: MatrixMeasure[] = [];
  /** The grand-total row from the engine (cells per column, `total` for the corner). */
  @Prop() grandTotal?: MatrixNode;
  /** Header of each row level, top first, e.g. ['Group', 'Class']. */
  @Prop() rowLevels: string[] = [];
  /** Caption above the column members, e.g. 'Condition grade'. */
  @Prop() columnHeader?: string;
  /** Row levels open on load (0: only the top rows; 1: their children too…). */
  @Prop() expandLevel = 0;
  /** Scroll inside the card past this height (px); the header row and first column stay put. */
  @Prop() maxHeight = 440;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() expanded: Set<string> = new Set();
  @State() focus: Cell = { r: 0, c: 0 };
  /** The grid is wider than the card: the first column sticks (and needs an opaque background). */
  @State() overflowX = false;

  private scroller: HTMLElement | null = null;
  private sizer = new WidthObserver(() => this.measureOverflow());

  private measureOverflow(): void {
    const el = this.scroller;
    const overflow = Boolean(el && el.scrollWidth > el.clientWidth + 1);
    if (overflow !== this.overflowX) this.overflowX = overflow;
  }

  componentDidRender(): void {
    this.measureOverflow();
  }

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  @Watch('nodes')
  @Watch('expandLevel')
  resetExpansion(): void {
    this.expanded = initialExpanded(this.nodes, this.expandLevel);
  }

  componentWillLoad(): void {
    this.resetExpansion();
  }

  private get fields(): string[] {
    return this.rowFields.length ? this.rowFields : this.crossFilterField ? [this.crossFilterField] : [];
  }

  private get isInteractive(): boolean {
    return this.interactive ?? Boolean(this.fields.length || this.columnField);
  }

  private model = () => matrixTable(this.nodes, this.columns, this.measures, { rowLevels: this.rowLevels, grandTotal: this.grandTotal });

  private valueColumns(): ValueColumn[] {
    const pivot = this.columns.length > 0;
    const cells: ValueColumn[] = pivot
      ? this.columns.flatMap((_, ci) => this.measures.map((measure) => ({ measure, column: ci, total: false })))
      : this.measures.map((measure) => ({ measure, column: null, total: false }));
    const totals = pivot && [...this.nodes, ...(this.grandTotal ? [this.grandTotal] : [])].some((n) => n.total);
    return totals ? [...cells, ...this.measures.map((measure) => ({ measure, column: null, total: true }))] : cells;
  }

  private toggle(path: string): void {
    const next = new Set(this.expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.expanded = next;
  }

  /** Reports a row (header, total cell) or a cell (row + column member). The grand-total row reports only its column. */
  private pick(row: VisibleRow | null, vc: ValueColumn | null): void {
    if (!this.isInteractive) return;
    const filters: DataPointFilter[] = [];
    const rowField = row ? this.fields[row.depth] : undefined;
    if (row && rowField) filters.push({ field: rowField, value: clickValue(row.node), label: row.node.label });
    const member = vc && !vc.total && vc.column !== null ? this.columns[vc.column] : undefined;
    if (member && this.columnField) filters.push({ field: this.columnField, value: clickValue(member), label: member.label });
    if (!filters.length) return;
    const [first] = filters;
    this.dataPointClick.emit({
      visualId: this.visualId ?? null,
      field: first?.field ?? null,
      value: first?.value ?? null,
      label: filters.map((f) => f.label).join(' · '),
      filters,
    });
  }

  private moveFocus(cell: Cell): void {
    this.focus = cell;
    // Keyboard moves never animate; focus follows on the next frame (after the re-render)
    requestAnimationFrame(() => {
      const target = this.host.shadowRoot?.querySelector<HTMLElement>(`[data-cell="${cell.r}:${cell.c}"]`);
      target?.focus();
    });
  }

  private onKeyDown(e: KeyboardEvent, rows: VisibleRow[], width: number): void {
    const { r, c } = this.focus;
    const total = this.grandTotal ? 1 : 0;
    const height = rows.length + total;
    const row = rows[r] ?? null;
    const go = (cell: Cell) => {
      e.preventDefault();
      this.moveFocus({ r: Math.max(0, Math.min(height - 1, cell.r)), c: Math.max(0, Math.min(width - 1, cell.c)) });
    };
    switch (e.key) {
      case 'ArrowDown':
        return go({ r: r + 1, c });
      case 'ArrowUp':
        return go({ r: r - 1, c });
      case 'ArrowRight':
        if (c === 0 && row?.hasChildren && !row.expanded) {
          e.preventDefault();
          this.toggle(row.path);
          return;
        }
        return go({ r, c: c + 1 });
      case 'ArrowLeft':
        if (c === 0 && row?.expanded) {
          e.preventDefault();
          this.toggle(row.path);
          return;
        }
        if (c === 0 && row?.parent) return go({ r: rows.findIndex((x) => x.path === row.parent), c: 0 });
        return go({ r, c: c - 1 });
      case 'Home':
        return go({ r: e.ctrlKey ? 0 : r, c: 0 });
      case 'End':
        return go({ r: e.ctrlKey ? height - 1 : r, c: width - 1 });
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const vc = c > 0 ? (this.valueColumns()[c - 1] ?? null) : null;
        if (c === 0 && row?.hasChildren && e.key === ' ') this.toggle(row.path);
        else this.pick(row, vc);
        return;
      }
      default:
    }
  }

  private renderGrid = () => {
    const rows = visibleRows(this.nodes, this.expanded);
    const vcs = this.valueColumns();
    const width = vcs.length + 1;
    const heat = heatScales(this.nodes, this.measures);
    const pivot = this.columns.length > 0;
    const many = this.measures.length > 1;
    const interactive = this.isInteractive;
    const fmt = (m: MatrixMeasure) => formatter(m.format ?? this.format);
    const focus = { r: Math.min(this.focus.r, rows.length + (this.grandTotal ? 0 : -1)), c: Math.min(this.focus.c, width - 1) };
    const hasRowSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const p = this.testIdPrefix;
    const totalLabel = (m: MatrixMeasure) => (many ? `Total · ${m.label}` : 'Total');

    const valueOf = (n: MatrixNode, vc: ValueColumn) => (vc.total ? (n.total?.[vc.measure.id] ?? null) : (n.cells[vc.measure.id]?.[vc.column ?? 0] ?? null));
    const cellLabel = (rowLabel: string, vc: ValueColumn) =>
      [rowLabel, vc.total ? totalLabel(vc.measure) : vc.column !== null ? this.columns[vc.column]?.label : undefined, many || !pivot ? vc.measure.label : undefined]
        .filter(Boolean)
        .join(', ');

    const renderCells = (n: MatrixNode, r: number, row: VisibleRow | null, deepest: boolean) =>
      vcs.map((vc, k) => {
        const c = k + 1;
        const v = valueOf(n, vc);
        const colour = deepest && !vc.total ? heat.get(vc.measure.id)?.(v) : null;
        const member = vc.column !== null && !vc.total ? this.columns[vc.column] : undefined;
        const colSelected = member !== undefined && sameValue(clickValue(member), this.selectedColumn);
        return (
          <td
            key={`${vc.total ? 't' : (member?.id ?? 'v')}|${vc.measure.id}`}
            role="gridcell"
            class={{ 'mx-cell': true, 'u-num': true, 'mx-cell--total': vc.total }}
            data-cell={`${r}:${c}`}
            data-heat={colour ? 'true' : undefined}
            data-selected={colSelected ? 'true' : undefined}
            data-testid={p && member ? `${p}-cell-${row ? row.path : 'total'}-${member.id}` : undefined}
            tabindex={focus.r === r && focus.c === c ? 0 : -1}
            aria-label={`${cellLabel(row ? row.node.label : 'Total', vc)}: ${v === null ? 'no value' : fmt(vc.measure)(v)}`}
            style={colour ? { background: colour.fill, color: colour.text } : undefined}
            onClick={() => {
              this.focus = { r, c };
              this.pick(row, vc);
            }}
          >
            {v === null ? '—' : fmt(vc.measure)(v)}
          </td>
        );
      });

    const deepestLevel = rows.reduce((d, x) => Math.max(d, x.depth), 0);
    const flat = !rows.some((x) => x.hasChildren);

    return (
      <div
        class="mx-scroll"
        data-overflow={String(this.overflowX)}
        style={{ maxHeight: `${this.maxHeight}px` }}
        ref={(el) => {
          this.scroller = el ?? null;
          this.sizer.observe(el);
        }}
      >
        <table
          class={{ 'u-table': true, mx: true, 'mx--pivot': pivot }}
          style={pivot ? { minWidth: `${ROW_HEADER_PX + vcs.length * VALUE_COLUMN_PX}px` } : undefined}
          role="treegrid"
          aria-label={chartLabel(this)}
          aria-readonly="true"
          data-interactive={String(interactive)}
          onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, rows, width)}
        >
          {pivot && (
            <colgroup>
              <col style={{ width: `${ROW_HEADER_PX}px` }} />
              {vcs.map((vc) => (
                <col key={`${vc.total ? 't' : String(vc.column)}|${vc.measure.id}`} />
              ))}
            </colgroup>
          )}
          <thead>
            {pivot && (many || this.columnHeader) && (
              <tr role="row">
                <th role="columnheader" class="mx-corner" rowSpan={2} scope="col">
                  {this.rowLevels.join(' › ') || 'Row'}
                </th>
                {many ? (
                  [
                    ...this.columns.map((col) => (
                      <th key={col.id} role="columnheader" colSpan={this.measures.length} class="mx-group" scope="colgroup">
                        {col.label}
                      </th>
                    )),
                    vcs.some((vc) => vc.total) ? (
                      <th key="__total" role="columnheader" colSpan={this.measures.length} class="mx-group" scope="colgroup">
                        Total
                      </th>
                    ) : null,
                  ]
                ) : (
                  <th role="columnheader" colSpan={vcs.length} class="mx-group" scope="colgroup">
                    {this.columnHeader}
                  </th>
                )}
              </tr>
            )}
            <tr role="row">
              {!(pivot && (many || this.columnHeader)) && (
                <th role="columnheader" class="mx-corner" scope="col">
                  {this.rowLevels.join(' › ') || 'Row'}
                </th>
              )}
              {vcs.map((vc) => {
                const member = vc.column !== null && !vc.total ? this.columns[vc.column] : undefined;
                const text = vc.total ? (many ? vc.measure.label : 'Total') : pivot && !many ? (member?.label ?? '') : vc.measure.label;
                return (
                  <th
                    key={`${vc.total ? 't' : (member?.id ?? 'v')}|${vc.measure.id}`}
                    role="columnheader"
                    scope="col"
                    class="mx-colhead"
                    data-selected={member && sameValue(clickValue(member), this.selectedColumn) ? 'true' : undefined}
                  >
                    {text}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const selected = hasRowSelection && sameValue(clickValue(row.node), this.selectedValue);
              return (
                <tr
                  key={row.path}
                  role="row"
                  aria-level={flat ? undefined : String(row.depth + 1)}
                  aria-expanded={row.hasChildren ? String(row.expanded) : undefined}
                  aria-selected={interactive ? String(selected) : undefined}
                  data-depth={String(row.depth)}
                  data-parent={row.hasChildren ? 'true' : undefined}
                  data-testid={p ? `${p}-row-${row.path}` : undefined}
                >
                  <th
                    role="rowheader"
                    scope="row"
                    class="mx-rowhead"
                    data-cell={`${r}:0`}
                    tabindex={focus.r === r && focus.c === 0 ? 0 : -1}
                    style={{ '--depth': String(row.depth) }}
                    onClick={() => {
                      this.focus = { r, c: 0 };
                      this.pick(row, null);
                    }}
                  >
                    <span class="mx-rowhead__inner">
                      {row.hasChildren ? (
                        <button
                          type="button"
                          class="mx-toggle"
                          tabindex={-1}
                          aria-label={`${row.expanded ? 'Collapse' : 'Expand'} ${row.node.label}`}
                          data-testid={p ? `${p}-toggle-${row.path}` : undefined}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            this.focus = { r, c: 0 };
                            this.toggle(row.path);
                          }}
                        >
                          <Icon node={UI_ICONS.next} size={14} />
                        </button>
                      ) : (
                        !flat && <span class="mx-toggle-space" aria-hidden="true" />
                      )}
                      <span class="mx-rowhead__label" title={row.node.label}>
                        {row.node.label}
                      </span>
                    </span>
                  </th>
                  {renderCells(row.node, r, row, row.depth === deepestLevel && !row.hasChildren)}
                </tr>
              );
            })}
            {this.grandTotal && (
              <tr role="row" class="mx-grand" data-testid={p ? `${p}-row-total` : undefined}>
                <th
                  role="rowheader"
                  scope="row"
                  class="mx-rowhead"
                  data-cell={`${rows.length}:0`}
                  tabindex={focus.r === rows.length && focus.c === 0 ? 0 : -1}
                >
                  <span class="mx-rowhead__inner">
                    <span class="mx-rowhead__label">{this.grandTotal.label || 'Total'}</span>
                  </span>
                </th>
                {renderCells(this.grandTotal, rows.length, null, false)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.nodes.length > 0 && this.measures.length > 0}
          renderChart={this.renderGrid}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
