import type React from 'react';
import { Sliders, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useFilterStore } from '../../store/filters';
import { AVAILABLE_GROUPS } from './constants';

const chip = (selected: boolean) =>
  `px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
    selected
      ? 'bg-teal-600 text-white shadow-xs'
      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  }`;

export const FilterBar: React.FC = () => {
  const { group, className, kpiFocus } = useFilterStore(
    useShallow((s) => ({ group: s.group, className: s.className, kpiFocus: s.kpiFocus }))
  );
  const actions = useFilterStore(
    useShallow((s) => ({
      toggleGroup: s.toggleGroup,
      clearGroup: s.clearGroup,
      clearClass: s.clearClass,
      setKpiFocus: s.setKpiFocus,
      clearScope: s.clearScope,
      resetAll: s.resetAll,
    }))
  );

  const hasActiveFilters = Boolean(group || className || kpiFocus !== 'all');

  return (
    <div className="bg-slate-50 border-b border-slate-200/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-1 shrink-0">
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <span>Cross-Filter by Group:</span>
        </div>

        <button
          type="button"
          onClick={actions.clearScope}
          className={chip(!group)}
        >
          All Asset Groups
        </button>

        {AVAILABLE_GROUPS.map((grp) => (
          <button type="button" key={grp} onClick={() => actions.toggleGroup(grp)} className={chip(group === grp)}>
            {grp}
          </button>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2" data-testid="active-filters">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Filters:</span>

          {group && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-300">
              Group: <strong>{group}</strong>
              <button
                type="button"
                onClick={actions.clearGroup}
                className="hover:text-teal-950 p-0.5 cursor-pointer"
                title="Remove group filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {className && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
              Class: <strong>{className}</strong>
              <button
                type="button"
                onClick={actions.clearClass}
                className="hover:text-indigo-950 p-0.5 cursor-pointer"
                title="Remove class filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {kpiFocus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
              Focus: <strong>{kpiFocus === 'renewal' ? 'Due for Renewal' : 'Condition Assessed'}</strong>
              <button
                type="button"
                onClick={() => actions.setKpiFocus('all')}
                className="hover:text-amber-950 p-0.5 cursor-pointer"
                title="Reset KPI filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={actions.resetAll}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline ml-1 cursor-pointer"
          >
            Reset All
          </button>
        </div>
      )}
    </div>
  );
};
