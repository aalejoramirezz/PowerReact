import { create } from 'zustand';
import type { DashboardFilters, KpiFocus } from '../lib/dax/types';

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
  resetAll: () => void;
  /** Applies a full target in one update (search is cleared) and returns the new filters. */
  focus: (target: FocusTarget) => DashboardFilters;
}

export type FilterState = DashboardFilters & FilterActions;

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

export const useFilterStore = create<FilterState>()((set, get) => ({
  ...INITIAL_FILTERS,

  toggleGroup: (group) =>
    set((s) => (s.group === group ? { group: null } : { group, className: null })),
  clearGroup: () => set({ group: null }),
  clearScope: () => set({ group: null, className: null }),

  toggleClass: (className) => set((s) => ({ className: s.className === className ? null : className })),
  clearClass: () => set({ className: null }),

  setKpiFocus: (kpiFocus) => set({ kpiFocus }),
  toggleKpiFocus: (focus) => set((s) => ({ kpiFocus: s.kpiFocus === focus ? 'all' : focus })),

  setSearch: (search) => set({ search }),
  resetAll: () => set(INITIAL_FILTERS),

  focus: (target) => {
    set({ ...target, search: '' });
    return selectFilters(get());
  },
}));
