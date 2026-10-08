import type React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useFilterStore } from '../../store/filters';
import { RemovableChip, Tab, Tabs } from '../ui/primitives';
import { AVAILABLE_GROUPS } from './constants';

/** Bring the chosen filter fully into view when the row scrolls (phones). */
const reveal = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });

/**
 * Group filter as Lens page-navigator buttons (framed, no shadow, selected = teal fill), in a row
 * that scrolls horizontally on narrow screens. The summary on the right lists only the filters that
 * are not visible here (class, KPI focus, search); Reset all appears whenever anything is filtered.
 */
export const FilterBar: React.FC = () => {
  const { group, className, kpiFocus, search } = useFilterStore(
    useShallow((s) => ({ group: s.group, className: s.className, kpiFocus: s.kpiFocus, search: s.search }))
  );
  const actions = useFilterStore(
    useShallow((s) => ({
      toggleGroup: s.toggleGroup,
      clearClass: s.clearClass,
      setKpiFocus: s.setKpiFocus,
      setSearch: s.setSearch,
      clearScope: s.clearScope,
      resetAll: s.resetAll,
    }))
  );

  const term = search.trim();
  const hasActiveFilters = Boolean(group || className || kpiFocus !== 'all' || term);

  return (
    // flex-auto (not flex-1): the buttons' own width is the basis, so the chips drop to a second line
    // instead of squeezing the selected group out of view; alone on a line, the buttons scroll
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-auto items-center gap-3">
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-u-label @md:flex">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Group
        </span>
        <Tabs label="Filter by asset group" className="u-scroll-x min-w-0">
          <Tab
            active={!group}
            onClick={(e) => {
              reveal(e);
              actions.clearScope();
            }}
          >
            All groups
          </Tab>
          {AVAILABLE_GROUPS.map((grp) => (
            <Tab
              key={grp}
              active={group === grp}
              onClick={(e) => {
                reveal(e);
                actions.toggleGroup(grp);
              }}
            >
              {grp}
            </Tab>
          ))}
        </Tabs>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2" data-testid="active-filters">
          {className && (
            <RemovableChip label="Class" value={className} onRemove={actions.clearClass} removeLabel="Remove class filter" />
          )}
          {kpiFocus !== 'all' && (
            <RemovableChip
              label="Focus"
              value={kpiFocus === 'renewal' ? 'Due for renewal' : 'Condition assessed'}
              onRemove={() => actions.setKpiFocus('all')}
              removeLabel="Reset KPI focus"
            />
          )}
          {term && <RemovableChip label="Search" value={term} onRemove={() => actions.setSearch('')} removeLabel="Clear search" />}
          <button
            type="button"
            onClick={actions.resetAll}
            className="cursor-pointer px-1 text-[11.5px] font-semibold text-u-bad-text underline underline-offset-2"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
};
