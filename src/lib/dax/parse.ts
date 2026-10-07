import type { ClassRow, DaxRow, GroupRow, KpiData } from './types';

// executeQueries keys: measures as "[Name]", columns as "table[Column]"
const COL = {
  group: 'asset_class_group[Asset_Class_Group]',
  className: 'asset_class[Asset_Class]',
} as const;

/** Numbers may arrive as numbers, numeric strings or null (includeNulls: true). */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toLabel(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value : 'Unknown';
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export const EMPTY_KPIS: KpiData = {
  totalAssets: 0,
  totalAssessed: 0,
  dueForRenewal: 0,
  avgBaseLife: 0,
  pctAssessed: 0,
};

export function parseKpis(rows: DaxRow[]): KpiData {
  const row = rows[0];
  if (!row) return EMPTY_KPIS;

  const totalAssets = toNumber(row['[TotalAssets]']);
  const totalAssessed = toNumber(row['[TotalAssessed]']);
  const pct = toNumber(row['[PctAssessed]']);

  return {
    totalAssets,
    totalAssessed,
    dueForRenewal: toNumber(row['[DueForRenewal]']),
    avgBaseLife: Math.round(toNumber(row['[AvgBaseLife]']) * 10) / 10,
    pctAssessed: pct || ratio(totalAssessed, totalAssets),
  };
}

/** Sorted by count desc; `share` is relative to the sum of all returned groups. */
export function parseGroups(rows: DaxRow[]): GroupRow[] {
  const parsed = rows.map((r) => {
    const count = toNumber(r['[AssetCount]']);
    const assessed = toNumber(r['[Assessed]']);
    return {
      group: toLabel(r[COL.group]),
      count,
      assessed,
      dueForRenewal: toNumber(r['[DueForRenewal]']),
      pctAssessed: ratio(assessed, count),
    };
  });

  const total = parsed.reduce((sum, g) => sum + g.count, 0);
  return parsed.map((g) => ({ ...g, share: ratio(g.count, total) })).sort((a, b) => b.count - a.count);
}

/** Sorted by count desc (TOPN does not guarantee row order). */
export function parseClasses(rows: DaxRow[]): ClassRow[] {
  return rows
    .map((r) => {
      const count = toNumber(r['[AssetCount]']);
      const assessed = toNumber(r['[Assessed]']);
      return {
        className: toLabel(r[COL.className]),
        count,
        assessed,
        dueForRenewal: toNumber(r['[DueForRenewal]']),
        pctAssessed: ratio(assessed, count),
      };
    })
    .sort((a, b) => b.count - a.count);
}
