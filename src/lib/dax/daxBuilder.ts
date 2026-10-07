import type { DashboardFilters } from './types';

export const GROUP_COLUMN = "'asset_class_group'[Asset_Class_Group]";
export const CLASS_COLUMN = "'asset_class'[Asset_Class]";

/** Max rows the class table asks for (after search / KPI focus are applied in the engine). */
export const CLASS_LIMIT = 35;

/** DAX string literal: wraps in quotes and doubles embedded quotes. */
export function daxString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** A value a filter can carry: the category value exactly as the semantic model returned it. */
export type DaxLiteralValue = string | number | boolean;

/**
 * DAX literal for a filter value, never hand-interpolated: strings are quoted and escaped, numbers
 * are written in plain decimal notation (DAX has no `1e21`), booleans become TRUE() / FALSE().
 */
export function daxLiteral(value: DaxLiteralValue): string {
  if (typeof value === 'string') return daxString(value);
  if (typeof value === 'boolean') return value ? 'TRUE()' : 'FALSE()';
  if (!Number.isFinite(value)) throw new Error(`Cannot filter on a non-finite number (${value})`);
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
}

/** `TREATAS({v1, v2…}, column)`: applies values of a column as a filter. */
export function treatAs(values: DaxLiteralValue | readonly DaxLiteralValue[], column: string): string {
  const list: readonly DaxLiteralValue[] = Array.isArray(values) ? values : [values];
  if (list.length === 0) throw new Error('TREATAS needs at least one value');
  return `TREATAS({${list.map(daxLiteral).join(', ')}}, ${column})`;
}

/** Case-insensitive "contains" filter table usable as a SUMMARIZECOLUMNS filter argument. */
export function containsFilter(column: string, term: string): string {
  return `FILTER(VALUES(${column}), CONTAINSSTRING(${column}, ${daxString(term)}))`;
}

const indentBlock = (text: string) =>
  text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

/** Renders `FN(\n  arg1,\n  arg2\n)`, indenting multi-line arguments. */
export function call(fn: string, args: readonly string[]): string {
  return `${fn}(\n${args.map(indentBlock).join(',\n')}\n)`;
}

export const evaluate = (table: string) => `EVALUATE\n${table}`;

const BREAKDOWN_MEASURES = [
  '"AssetCount", [Asset Count (All States)]',
  '"Assessed", [Assets Assessed For Condition]',
  '"DueForRenewal", [Assets Due For Renewal]',
];

/** KPIs respect both the group and class cross-filters. */
export function buildKpiQuery({ group, className }: Pick<DashboardFilters, 'group' | 'className'>): string {
  return evaluate(
    call('SUMMARIZECOLUMNS', [
      ...(group ? [treatAs(group, GROUP_COLUMN)] : []),
      ...(className ? [treatAs(className, CLASS_COLUMN)] : []),
      '"TotalAssets", [Asset Count (All States)]',
      '"TotalAssessed", [Assets Assessed For Condition]',
      '"DueForRenewal", [Assets Due For Renewal]',
      '"AvgBaseLife", [Avg Base Life (Years)]',
      '"PctAssessed", [% Assessed For Condition]',
    ])
  );
}

/**
 * Groups always list every group (the selected one is highlighted, not filtered out),
 * narrowed only by the class cross-filter.
 */
export function buildGroupsQuery({ className }: Pick<DashboardFilters, 'className'>): string {
  return evaluate(
    call('SUMMARIZECOLUMNS', [
      GROUP_COLUMN,
      ...(className ? [treatAs(className, CLASS_COLUMN)] : []),
      ...BREAKDOWN_MEASURES,
    ])
  );
}

const FOCUS_CONDITION: Record<DashboardFilters['kpiFocus'], string | null> = {
  all: null,
  renewal: '[DueForRenewal] > 0',
  assessed: '[Assessed] > 0',
};

/**
 * Classes are scoped by group; search and KPI focus run in the engine *before* TOPN
 * so matches outside the top rows are still returned.
 */
export function buildClassesQuery({
  group,
  search,
  kpiFocus,
}: Pick<DashboardFilters, 'group' | 'search' | 'kpiFocus'>): string {
  const term = search.trim();
  const summarized = call('SUMMARIZECOLUMNS', [
    CLASS_COLUMN,
    ...(group ? [treatAs(group, GROUP_COLUMN)] : []),
    ...(term ? [containsFilter(CLASS_COLUMN, term)] : []),
    ...BREAKDOWN_MEASURES,
  ]);

  const condition = FOCUS_CONDITION[kpiFocus];
  const table = condition ? call('FILTER', [summarized, condition]) : summarized;

  return evaluate(call('TOPN', [String(CLASS_LIMIT), table, '[AssetCount]', 'DESC']));
}
