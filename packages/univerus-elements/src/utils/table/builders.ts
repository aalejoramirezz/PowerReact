import { rankedRows } from '../layout/bars';
import { ibcsRows } from '../layout/ibcs';
import type { TrendSeries } from '../layout/trend';
import type { BarItem, BulletItem, DonutItem, IbcsItem } from '../data';
import { clickValue } from '../data';
import type { FormatSpec } from '../formats';
import type { TableColumn, TableModel } from './model';

/**
 * Table models behind each visual's table view and its CSV / Excel export. Rows carry `__key`
 * (the category's click value) so a row click cross-filters exactly like a click on the chart.
 */
export const ROW_KEY = '__key';

const CATEGORY: TableColumn = { key: 'category', label: 'Category' };
const PERCENT: FormatSpec = { style: 'percent', decimals: 1 };

export function barsTable(data: readonly BarItem[], format: FormatSpec | undefined, { share = true } = {}): TableModel {
  const { rows } = rankedRows(data);
  return {
    columns: [
      CATEGORY,
      { key: 'value', label: 'Value', kind: 'number', format },
      ...(share ? [{ key: 'share', label: 'Share', kind: 'number', format: PERCENT } satisfies TableColumn] : []),
    ],
    rows: rows.map((r) => ({ [ROW_KEY]: clickValue(r.datum), category: r.datum.label, value: r.datum.value, share: r.share })),
  };
}

export function bulletTable(data: readonly BulletItem[], format: FormatSpec | undefined, targetLabel: string): TableModel {
  return {
    columns: [
      CATEGORY,
      { key: 'actual', label: 'Actual', kind: 'number', format },
      { key: 'target', label: targetLabel, kind: 'number', format },
      { key: 'variance', label: 'Variance', kind: 'number', format: PERCENT },
    ],
    rows: [...data]
      .sort((a, b) => b.actual - a.actual)
      .map((d) => ({
        [ROW_KEY]: clickValue(d),
        category: d.label,
        actual: d.actual,
        target: d.target,
        variance: d.target ? (d.actual - d.target) / d.target : null,
      })),
  };
}

export function donutTable(data: readonly DonutItem[], format: FormatSpec | undefined): TableModel {
  return barsTable(data, format);
}

export function trendTable(categories: readonly string[], series: readonly TrendSeries[], format: FormatSpec | undefined): TableModel {
  return {
    columns: [{ key: 'category', label: 'Period' }, ...series.map((s) => ({ key: `s:${s.id}`, label: s.label, kind: 'number' as const, format }))],
    rows: categories.map((category, i) => ({
      [ROW_KEY]: category,
      category,
      ...Object.fromEntries(series.map((s) => [`s:${s.id}`, s.values[i] ?? null])),
    })),
  };
}

export function ibcsTable(
  data: readonly IbcsItem[],
  format: FormatSpec | undefined,
  { actualLabel, comparisonLabel, goodWhen }: { actualLabel: string; comparisonLabel: string; goodWhen: 'higher' | 'lower' }
): TableModel {
  return {
    columns: [
      CATEGORY,
      { key: 'ac', label: actualLabel, kind: 'number', format },
      { key: 'cmp', label: comparisonLabel, kind: 'number', format },
      { key: 'dabs', label: `Δ${comparisonLabel}`, kind: 'number', format },
      { key: 'dpct', label: `Δ${comparisonLabel}%`, kind: 'number', format: PERCENT },
    ],
    rows: ibcsRows(data, { goodWhen, sort: 'natural' }).map((r) => ({
      [ROW_KEY]: clickValue(r.datum),
      category: r.datum.label,
      ac: r.ac,
      cmp: r.cmp,
      dabs: r.dabs,
      dpct: r.dpct,
    })),
  };
}
