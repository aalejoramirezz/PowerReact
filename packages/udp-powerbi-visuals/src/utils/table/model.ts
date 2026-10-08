import { formatValue, MISSING, type FormatSpec } from '../formats';

/**
 * Table model shared by the data-table element, every visual's table view and the CSV / Excel
 * export: columns are declarative (JSON-safe), rows are plain records.
 */

export type TableRow = Record<string, unknown>;

/** text · number · meter (value + mini meter + share) · status (chip when > 0, dash otherwise). */
export type ColumnKind = 'text' | 'number' | 'meter' | 'status';

export type ChipTone = 'ok' | 'warn' | 'bad' | 'accent';

export interface TableColumn {
  /** Row field. */
  key: string;
  /** Header text (also the CSV / Excel header). */
  label: string;
  kind?: ColumnKind;
  /** Default: end for numeric kinds, start for text. */
  align?: 'start' | 'end';
  format?: FormatSpec;
  /** meter: field holding the 0..1 ratio drawn as a mini meter (and shown as a percentage). */
  ratioKey?: string;
  /** status: text after the value, e.g. "due". */
  suffix?: string;
  /** status: chip tone when the value is above zero. */
  tone?: ChipTone;
  /** status: accessible text of the dash shown for zero / empty, e.g. "None due". */
  emptyLabel?: string;
  sortable?: boolean;
}

export interface TableModel {
  columns: TableColumn[];
  rows: TableRow[];
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export const PAGE_SIZES = [10, 25, 50] as const;

const NUMERIC: ReadonlySet<ColumnKind> = new Set(['number', 'meter', 'status']);

const isMissing = (v: unknown) => v === null || v === undefined || v === '';

export const isNumericColumn = (column: TableColumn) => NUMERIC.has(column.kind ?? 'text');

export const columnAlign = (column: TableColumn): 'start' | 'end' => column.align ?? (isNumericColumn(column) ? 'end' : 'start');

/**
 * Header text for an executeQueries key: `'table'[Column]` / `table[Column]` → Column, `[Measure]` → Measure.
 */
export function labelFromKey(key: string): string {
  const bracket = /\[([^\]]+)\]\s*$/.exec(key);
  return (bracket?.[1] ?? key).replace(/_/g, ' ').trim();
}

/** Columns inferred from raw rows (export of the query result): numbers when every value is numeric. */
export function columnsFromRows(rows: readonly TableRow[]): TableColumn[] {
  const keys: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  return keys.map((key) => {
    const values = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== '');
    const numeric = values.length > 0 && values.every((v) => typeof v === 'number');
    return { key, label: labelFromKey(key), kind: numeric ? 'number' : 'text' };
  });
}

/** Number when the cell is numeric (numbers or numeric strings), else null. */
export function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Display text of a cell (the table view and the accessible names of its rows). */
export function cellText(row: TableRow, column: TableColumn): string {
  const value = row[column.key];
  if (isNumericColumn(column)) {
    const n = cellNumber(value);
    if (n === null) return MISSING;
    return formatValue(n, column.format);
  }
  if (isMissing(value)) return MISSING;
  return String(value);
}

/** Raw value written to CSV / Excel: numbers stay numbers, everything else becomes text. */
export function exportValue(row: TableRow, column: TableColumn): string | number | boolean | null {
  const value = row[column.key];
  if (isMissing(value)) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' || isNumericColumn(column)) return cellNumber(value);
  return String(value);
}

function compare(a: unknown, b: unknown, numeric: boolean): number {
  if (numeric) return (cellNumber(a) ?? 0) - (cellNumber(b) ?? 0);
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/** Stable sort; missing values always last, whatever the direction. */
export function sortRows(rows: readonly TableRow[], sort: SortState | null, columns: readonly TableColumn[]): TableRow[] {
  if (!sort) return [...rows];
  const column = columns.find((c) => c.key === sort.key);
  if (!column) return [...rows];
  const numeric = isNumericColumn(column);
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      const a = x.row[column.key];
      const b = y.row[column.key];
      if (isMissing(a) || isMissing(b)) return isMissing(a) === isMissing(b) ? x.i - y.i : isMissing(a) ? 1 : -1;
      return sign * compare(a, b, numeric) || x.i - y.i;
    })
    .map(({ row }) => row);
}

/** Next sort after a header click: numbers start high → low, text A → Z; a second click flips it. */
export function nextSort(current: SortState | null, column: TableColumn): SortState {
  if (current?.key === column.key) return { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key: column.key, dir: isNumericColumn(column) ? 'desc' : 'asc' };
}

export interface Page {
  rows: TableRow[];
  /** 0-based page actually shown (clamped). */
  page: number;
  pageCount: number;
  /** 1-based first / last row numbers shown (0 when empty). */
  first: number;
  last: number;
  total: number;
}

export function paginate(rows: readonly TableRow[], page: number, pageSize: number): Page {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pageCount - 1);
  const start = current * size;
  const shown = rows.slice(start, start + size);
  return { rows: shown, page: current, pageCount, first: total ? start + 1 : 0, last: start + shown.length, total };
}
