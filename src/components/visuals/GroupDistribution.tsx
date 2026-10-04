import type React from 'react';
import { TrendingUp } from 'lucide-react';
import type { GroupRow } from '../../lib/dax/types';
import { EmptyNote, ErrorNote, LoadingNote } from './StatusNote';

interface GroupDistributionProps {
  groups: GroupRow[] | undefined;
  selectedGroup: string | null;
  onToggleGroup: (group: string) => void;
  isLoading: boolean;
  isStale: boolean;
  error: unknown;
}

export const GroupDistribution: React.FC<GroupDistributionProps> = ({
  groups,
  selectedGroup,
  onToggleGroup,
  isLoading,
  isStale,
  error,
}) => {
  const maxCount = groups?.[0]?.count || 1;

  let body: React.ReactNode;
  if (!groups) {
    body = error ? <ErrorNote error={error} /> : isLoading ? <LoadingNote /> : null;
  } else if (groups.length === 0) {
    body = <EmptyNote>No asset groups returned for the current cross-filters.</EmptyNote>;
  } else {
    body = groups.map((grp) => {
      const isSelected = selectedGroup === grp.group;
      const isDimmed = selectedGroup !== null && !isSelected;
      const barWidth = Math.max(5, (grp.count / maxCount) * 100);

      return (
        <button
          type="button"
          key={grp.group}
          onClick={() => onToggleGroup(grp.group)}
          aria-pressed={isSelected}
          data-testid={`group-bar-${grp.group}`}
          className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
            isSelected
              ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-2 ring-teal-500/20'
              : isDimmed
                ? 'border-slate-100 bg-slate-50/40 opacity-60 hover:opacity-100 hover:border-slate-300'
                : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{grp.group}</span>
              {isSelected && (
                <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                  Cross-Filtered
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-900 font-bold">{grp.count.toLocaleString()}</span>
              <span className="text-slate-400 text-[11px]" data-testid={`group-share-${grp.group}`}>
                ({(grp.share * 100).toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isSelected ? 'bg-teal-600' : isDimmed ? 'bg-slate-300' : 'bg-slate-400'
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
            <span>
              Assessed: <strong className="text-slate-700">{grp.assessed.toLocaleString()}</strong> (
              {(grp.pctAssessed * 100).toFixed(0)}%)
            </span>
            <span>
              Renewal:{' '}
              <strong className={grp.dueForRenewal > 0 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                {grp.dueForRenewal.toLocaleString()}
              </strong>
            </span>
          </div>
        </button>
      );
    });
  }

  return (
    <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            Asset Distribution by Group
          </h3>
          <p className="text-xs text-slate-500">⚡ Click any bar to cross-filter the classes and KPIs</p>
        </div>
        <span className="text-[11px] font-mono text-slate-400">{groups?.length ?? 0} groups</span>
      </div>

      {groups && error ? (
        <div className="mb-3">
          <ErrorNote error={error} />
        </div>
      ) : null}

      <div className={`space-y-3.5 flex-1 transition-opacity ${isStale ? 'opacity-60' : ''}`}>{body}</div>
    </div>
  );
};
