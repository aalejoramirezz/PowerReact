import { create } from 'zustand';
import type { DashboardFilters, KpiFocus } from '../lib/dax/types';
import type { CrossFilter } from '../lib/manifest/crossFilters';
import { sameColumn } from '../lib/manifest/daxInjection';

export type { CrossFilter } from '../lib/manifest/crossFilters';

/** A filter combination the voice briefing (or future chat) can jump to atomically. */
export type FocusTarget = Pick<DashboardFilters, 'group' | 'className' | 'kpiFocus'>;

interface FilterActions {
  /** Selects a group (clearing any class from the previous group) or unselects it. */
  toggleGroup: (group: string) => void;
  clearGroup: () => void;
  /** Drops both group and class (keeps KPI focus and search). */
  clearScope: () => void;
  toggleClass: (className: string) => void;
  clearClass: () => void;
  setKpiFocus: (focus: KpiFocus) => void;
  /** Activates a KPI focus, or returns to 'all' if it is already active. */
  toggleKpiFocus: (focus: Exclude<KpiFocus, 'all'>) => void;
  setSearch: (search: string) => void;
  /** Clears every filter: the /visuals ones and every manifest dashboard's cross-filters. */
  resetAll: () => void;
  /** Applies a full target in one update (search is cleared) and returns the new filters. */
  focus: (target: FocusTarget) => DashboardFilters;

  /**
   * Manifest dashboards: the same column and value again removes the filter; the same column with
   * another value replaces it; a new column adds one.
   */
  toggleCrossFilter: (dashboardId: string, filter: CrossFilter) => void;
  clearCrossFilter: (dashboardId: string, field: string) => void;
  clearDashboard: (dashboardId: string) => void;
}

interface CrossFilterState {
  /** Manifest cross-filters, per dashboard (manifest id): dashboards never filter each other. */
  crossFilters: Record<string, CrossFilter[]>;
}

export type FilterState = DashboardFilters & CrossFilterState & FilterActions;

export const INITIAL_FILTERS: DashboardFilters = {
  group: null,
  className: null,
  kpiFocus: 'all',
  search: '',
};

export const selectFilters = (s: FilterState): DashboardFilters => ({
  group: s.group,
  className: s.className,
  kpiFocus: s.kpiFocus,
  search: s.search,
});

const NO_CROSS_FILTERS: CrossFilter[] = [];

/** A dashboard's cross-filters (a stable empty array when it has none). */
export const selectCrossFilters = (dashboardId: string) => (s: FilterState): CrossFilter[] =>
  s.crossFilters[dashboardId] ?? NO_CROSS_FILTERS;

export const useFilterStore = create<FilterState>()((set, get) => ({
  ...INITIAL_FILTERS,
  crossFilters: {},

  toggleGroup: (group) =>
    set((s) => (s.group === group ? { group: null } : { group, className: null })),
  clearGroup: () => set({ group: null }),
  clearScope: () => set({ group: null, className: null }),

  toggleClass: (className) => set((s) => ({ className: s.className === className ? null : className })),
  clearClass: () => set({ className: null }),

  setKpiFocus: (kpiFocus) => set({ kpiFocus }),
  toggleKpiFocus: (focus) => set((s) => ({ kpiFocus: s.kpiFocus === focus ? 'all' : focus })),

  setSearch: (search) => set({ search }),
  resetAll: () => set({ ...INITIAL_FILTERS, crossFilters: {} }),

  focus: (target) => {
    set({ ...target, search: '' });
    return selectFilters(get());
  },

  toggleCrossFilter: (dashboardId, filter) =>
    set((s) => {
      const current = s.crossFilters[dashboardId] ?? [];
      const existing = current.find((f) => sameColumn(f.field, filter.field));
      const others = current.filter((f) => f !== existing);
      const next = existing && String(existing.value) === String(filter.value) ? others : [...others, filter];
      return { crossFilters: { ...s.crossFilters, [dashboardId]: next } };
    }),
  clearCrossFilter: (dashboardId, field) =>
    set((s) => ({
      crossFilters: { ...s.crossFilters, [dashboardId]: (s.crossFilters[dashboardId] ?? []).filter((f) => !sameColumn(f.field, field)) },
    })),
  clearDashboard: (dashboardId) =>
    set((s) => {
      const rest = { ...s.crossFilters };
      delete rest[dashboardId];
      return { crossFilters: rest };
    }),
}));
