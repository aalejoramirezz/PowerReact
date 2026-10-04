export type DaxRow = Record<string, unknown>;

/** Which subset of classes the KPI cards focus the table on. */
export type KpiFocus = 'all' | 'renewal' | 'assessed';

export interface DashboardFilters {
  group: string | null;
  className: string | null;
  kpiFocus: KpiFocus;
  search: string;
}

export interface KpiData {
  totalAssets: number;
  totalAssessed: number;
  dueForRenewal: number;
  avgBaseLife: number;
  pctAssessed: number;
}

export interface GroupRow {
  group: string;
  count: number;
  assessed: number;
  dueForRenewal: number;
  pctAssessed: number;
  /** Fraction of all assets returned by the groups query (0..1). */
  share: number;
}

export interface ClassRow {
  className: string;
  count: number;
  assessed: number;
  dueForRenewal: number;
  pctAssessed: number;
}

export interface DashboardSnapshot {
  filters: DashboardFilters;
  kpis: KpiData;
  groups: GroupRow[];
  classes: ClassRow[];
}
