import type React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useFilterStore } from '../../store/filters';
import { Tab, Tabs } from '../ui/primitives';
import { AVAILABLE_GROUPS } from './constants';

const RemovableChip: React.FC<{ label: string; value: string; onRemove: () => void; removeLabel: string }> = ({
  label,
  value,
  onRemove,
  removeLabel,
}) => (
  <span className="u-chip" data-tone="accent">
    {label}: <strong className="font-bold">{value}</strong>
    <button type="button" onClick={onRemove} className="-mr-1 grid h-4 w-4 cursor-pointer place-items-center rounded" title={removeLabel}>
      <X className="h-3 w-3" />
    </button>
  </span>
);

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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto py-0.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-u-label">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Cross-filter by group
        </span>
        <Tabs label="Cross-filter by group">
          <Tab active={!group} onClick={actions.clearScope}>
            All Asset Groups
          </Tab>
          {AVAILABLE_GROUPS.map((grp) => (
            <Tab key={grp} active={group === grp} onClick={() => actions.toggleGroup(grp)}>
              {grp}
            </Tab>
          ))}
        </Tabs>
      </div>

      {!hasActiveFilters && (
        <span className="flex items-center gap-2 text-[11px] font-semibold text-u-text-soft">
          <span className="u-status-dot" aria-hidden="true" />
          Live VertiPaq DAX · cross-filtering enabled
        </span>
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2" data-testid="active-filters">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-u-label">Active filters:</span>
          {group && <RemovableChip label="Group" value={group} onRemove={actions.clearGroup} removeLabel="Remove group filter" />}
          {className && (
            <RemovableChip label="Class" value={className} onRemove={actions.clearClass} removeLabel="Remove class filter" />
          )}
          {kpiFocus !== 'all' && (
            <RemovableChip
              label="Focus"
              value={kpiFocus === 'renewal' ? 'Due for Renewal' : 'Condition Assessed'}
              onRemove={() => actions.setKpiFocus('all')}
              removeLabel="Reset KPI filter"
            />
          )}
          <button
            type="button"
            onClick={actions.resetAll}
            className="ml-1 cursor-pointer text-[11.5px] font-semibold text-u-bad-text underline underline-offset-2"
          >
            Reset All
          </button>
        </div>
      )}
    </div>
  );
};
