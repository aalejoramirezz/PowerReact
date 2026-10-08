import type { Categorised } from '../data';
import type { FormatSpec } from '../formats';
import { rampColour, type SeriesColour } from '../palette';
import type { TableColumn, TableModel, TableRow } from '../table/model';
import { divergingStep, extent, sequentialStep } from './scales';

/**
 * Matrix (Lens matrix, FT XY heatmap): a pivot with hierarchical rows, an optional column dimension
 * and one or more measures. Every subtotal and total comes from the engine (ROLLUPADDISSUBTOTAL):
 * the element never adds up ratios or averages.
 */

export interface MatrixMeasure {
  id: string;
  label: string;
  format?: FormatSpec;
  /** Colour the cells of the deepest rows by value: sequential (low → high) or diverging around `center`. */
  heatmap?: 'none' | 'sequential' | 'diverging';
  /** diverging: the favourable side (default higher). */
  goodWhen?: 'higher' | 'lower';
  /** diverging: the reference value (default 0). */
  center?: number;
}

/** A member of the column dimension. */
export interface MatrixColumn extends Categorised {
  id: string;
  label: string;
}

export interface MatrixNode extends Categorised {
  id: string;
  label: string;
  /** cells[measureId][columnIndex]: one entry per column (a single entry without a column dimension). */
  cells: Record<string, Array<number | null>>;
  /** The row's total per measure across the columns, from the engine. */
  total?: Record<string, number | null>;
  children?: MatrixNode[];
}

export interface VisibleRow {
  node: MatrixNode;
  depth: number;
  /** Unique path of ids from the root, e.g. "Core/Buildings". */
  path: string;
  parent: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

export const nodePath = (parent: string | null, id: string): string => (parent === null ? id : `${parent}/${id}`);

/** Deepest level present (0 for a flat list). */
export function maxDepth(nodes: readonly MatrixNode[], depth = 0): number {
  return nodes.reduce((d, n) => Math.max(d, n.children?.length ? maxDepth(n.children, depth + 1) : depth), depth);
}

/** Paths expanded initially: every parent above `level` (level 1 opens the top rows' children). */
export function initialExpanded(nodes: readonly MatrixNode[], level: number, parent: string | null = null, depth = 0): Set<string> {
  const out = new Set<string>();
  if (depth >= level) return out;
  for (const n of nodes) {
    if (!n.children?.length) continue;
    const path = nodePath(parent, n.id);
    out.add(path);
    for (const p of initialExpanded(n.children, level, path, depth + 1)) out.add(p);
  }
  return out;
}

/** The rows on screen, depth-first, children only under expanded parents. */
export function visibleRows(nodes: readonly MatrixNode[], expanded: ReadonlySet<string>, parent: string | null = null, depth = 0): VisibleRow[] {
  return nodes.flatMap((node) => {
    const path = nodePath(parent, node.id);
    const hasChildren = Boolean(node.children?.length);
    const open = hasChildren && expanded.has(path);
    const row: VisibleRow = { node, depth, path, parent, hasChildren, expanded: open };
    return open ? [row, ...visibleRows(node.children ?? [], expanded, path, depth + 1)] : [row];
  });
}

/** Rows at the deepest level (the ones a heatmap compares). */
function leaves(nodes: readonly MatrixNode[], target: number, depth = 0): MatrixNode[] {
  return nodes.flatMap((n) => (depth === target ? [n] : leaves(n.children ?? [], target, depth + 1)));
}

/**
 * A colour function per heat-mapped measure, scaled over the deepest rows' cells only (subtotals
 * and totals are a different magnitude and stay plain). Null cells get no colour.
 */
export function heatScales(nodes: readonly MatrixNode[], measures: readonly MatrixMeasure[]): Map<string, (v: number | null | undefined) => SeriesColour | null> {
  const deepest = leaves(nodes, maxDepth(nodes));
  const scales = new Map<string, (v: number | null | undefined) => SeriesColour | null>();
  for (const m of measures) {
    if (!m.heatmap || m.heatmap === 'none') continue;
    const values = deepest.flatMap((n) => n.cells[m.id] ?? []);
    const range = extent(values);
    if (!range) continue;
    if (m.heatmap === 'sequential') {
      scales.set(m.id, (v) => {
        const step = sequentialStep(v, range);
        return step ? rampColour(step, 'sequential') : null;
      });
    } else {
      const center = m.center ?? 0;
      const maxDistance = Math.max(Math.abs(range[0] - center), Math.abs(range[1] - center));
      scales.set(m.id, (v) => {
        const step = divergingStep(v, { center, maxDistance, goodWhen: m.goodWhen });
        return step ? rampColour(step, 'diverging') : null;
      });
    }
  }
  return scales;
}

const cellKey = (columnId: string | null, measureId: string) => (columnId === null ? `m:${measureId}` : `c:${columnId}|${measureId}`);

/**
 * The export (and fallback table): the hierarchy flattened, one column per row level so subtotal
 * rows read as "Core, (blank)"; then every column × measure and the totals.
 */
export function matrixTable(
  nodes: readonly MatrixNode[],
  columns: readonly MatrixColumn[],
  measures: readonly MatrixMeasure[],
  { rowLevels, grandTotal }: { rowLevels: readonly string[]; grandTotal?: MatrixNode }
): TableModel {
  const depth = maxDepth(nodes);
  const levels = Array.from({ length: depth + 1 }, (_, i) => rowLevels[i] ?? (i === 0 ? 'Row' : `Level ${i + 1}`));
  const pivot = columns.length > 0;
  const withTotal = [...nodes, ...(grandTotal ? [grandTotal] : [])].some((n) => n.total);
  const valueColumns: TableColumn[] = pivot
    ? columns.flatMap((c) =>
        measures.map((m) => ({ key: cellKey(c.id, m.id), label: measures.length > 1 ? `${c.label} · ${m.label}` : c.label, kind: 'number' as const, format: m.format }))
      )
    : measures.map((m) => ({ key: cellKey(null, m.id), label: m.label, kind: 'number' as const, format: m.format }));
  const totalColumns: TableColumn[] =
    pivot && withTotal ? measures.map((m) => ({ key: `t:${m.id}`, label: measures.length > 1 ? `Total · ${m.label}` : 'Total', kind: 'number' as const, format: m.format })) : [];

  const rows: TableRow[] = [];
  const add = (n: MatrixNode, trail: string[]) => {
    const row: TableRow = Object.fromEntries(levels.map((_, i) => [`l${i}`, trail[i] ?? null]));
    for (const m of measures) {
      if (pivot) columns.forEach((c, ci) => (row[cellKey(c.id, m.id)] = n.cells[m.id]?.[ci] ?? null));
      else row[cellKey(null, m.id)] = n.cells[m.id]?.[0] ?? null;
      if (totalColumns.length) row[`t:${m.id}`] = n.total?.[m.id] ?? null;
    }
    rows.push(row);
  };
  const walk = (list: readonly MatrixNode[], trail: string[]) => {
    for (const n of list) {
      add(n, [...trail, n.label]);
      walk(n.children ?? [], [...trail, n.label]);
    }
  };
  walk(nodes, []);
  if (grandTotal) add(grandTotal, ['Total']);
  return { columns: [...levels.map((label, i) => ({ key: `l${i}`, label })), ...valueColumns, ...totalColumns], rows };
}
