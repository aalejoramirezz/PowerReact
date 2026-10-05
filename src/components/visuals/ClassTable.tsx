import type React from 'react';
import { CheckCircle, Search } from 'lucide-react';
import { CLASS_LIMIT } from '../../lib/dax/daxBuilder';
import type { ClassRow, KpiFocus } from '../../lib/dax/types';
import { ChartCard } from '../ui/Card';
import { cx } from '../ui/cx';
import { ErrorNote, LoadingState, MiniMeter, StatusChip } from '../ui/primitives';
import { CHART_DEFINITIONS } from './kpiDefinitions';

interface ClassTableProps {
  classes: ClassRow[] | undefined;
  selectedClass: string | null;
  onToggleClass: (className: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  scopeLabel: string;
  kpiFocus: KpiFocus;
  isLoading: boolean;
  isStale: boolean;
  error: unknown;
  index?: number;
  className?: string;
}

function emptyMessage(search: string, kpiFocus: KpiFocus): string {
  if (search.trim()) return `No asset classes match "${search.trim()}" in this scope.`;
  if (kpiFocus === 'renewal') return 'No asset classes in this scope are due for renewal.';
  if (kpiFocus === 'assessed') return 'No asset classes in this scope have condition assessments.';
  return 'No asset classes matched the current cross-filters.';
}

const FullWidthRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr role="row">
    <td role="cell" colSpan={4} className="!h-auto p-3">
      {children}
    </td>
  </tr>
);

/** "Which exact classes?" — a table, because precision matters more than pattern here (principle 19). */
export const ClassTable: React.FC<ClassTableProps> = ({
  classes,
  selectedClass,
  onToggleClass,
  search,
  onSearchChange,
  scopeLabel,
  kpiFocus,
  isLoading,
  isStale,
  error,
  index = 0,
  className,
}) => {
  let rows: React.ReactNode;
  if (!classes) {
    rows = error ? (
      <FullWidthRow>
        <ErrorNote error={error} />
      </FullWidthRow>
    ) : isLoading ? (
      <FullWidthRow>
        <LoadingState rows={5} />
      </FullWidthRow>
    ) : null;
  } else if (classes.length === 0) {
    rows = (
      <tr role="row">
        <td role="cell" colSpan={4} className="!h-auto py-12 text-center text-u-label">
          {emptyMessage(search, kpiFocus)}
        </td>
      </tr>
    );
  } else {
    rows = classes.map((cls) => {
      const isSelected = selectedClass === cls.className;
      return (
        <tr
          key={cls.className}
          onClick={() => onToggleClass(cls.className)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleClass(cls.className);
            }
          }}
          tabIndex={0}
          role="row"
          aria-selected={isSelected}
          data-interactive="true"
          className="select-none"
        >
          <td role="cell">
            <span className="flex items-center gap-2">
              {isSelected && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-u-interaction" />}
              <span className={cx('text-u-title', isSelected ? 'font-bold' : 'font-medium')}>{cls.className}</span>
            </span>
          </td>
          <td role="cell" className="u-num text-right font-semibold text-u-title">
            {cls.count.toLocaleString()}
          </td>
          <td role="cell">
            <span className="u-cell-end flex items-center gap-2.5">
              <span className="u-num">{cls.assessed.toLocaleString()}</span>
              <MiniMeter value={cls.pctAssessed} className="w-14" />
              <span className="u-num w-9 text-right text-[11px] text-u-label">{(cls.pctAssessed * 100).toFixed(0)}%</span>
            </span>
          </td>
          {/* One renewal signal (the old Status column repeated it) */}
          <td role="cell" className="text-right">
            {cls.dueForRenewal > 0 ? (
              <StatusChip tone="warn" className="u-num">
                {cls.dueForRenewal.toLocaleString()} due
              </StatusChip>
            ) : (
              <span className="text-u-label" aria-label="None due">
                —
              </span>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <ChartCard
      title={`Asset Classes (${scopeLabel})`}
      subtitle="Inventory, condition and renewals by class"
      info={CHART_DEFINITIONS.classes.info}
      calc={CHART_DEFINITIONS.classes.calc}
      aside={
        <label className="relative block flex-1 @md:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-label" />
          <input
            type="search"
            placeholder="Search classes in model..."
            aria-label="Search asset classes"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="u-input w-full pl-8 @md:w-52"
          />
        </label>
      }
      index={index}
      className={className}
    >
      {classes && error ? (
        <div className="mb-3">
          <ErrorNote error={error} />
        </div>
      ) : null}

      <div
        className={cx(
          'max-h-[440px] overflow-y-auto rounded-[10px] border border-u-card-border transition-opacity',
          isStale && 'opacity-60'
        )}
      >
        {/* Explicit roles: below ~520px the rows restyle as a two-line list (u-table--stack) */}
        <table className="u-table u-table--stack" role="table" aria-label={`Asset classes (${scopeLabel})`}>
          <thead>
            <tr role="row" className="whitespace-nowrap">
              <th role="columnheader">Asset Class</th>
              <th role="columnheader" className="!text-right">
                Inventory
              </th>
              <th role="columnheader" className="!text-right">
                Condition Assessed
              </th>
              <th role="columnheader" className="!text-right">
                Renewals
              </th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>

      {classes && classes.length >= CLASS_LIMIT && (
        <p className="mt-2 text-[11px] text-u-label">
          Showing the top {CLASS_LIMIT} classes by inventory. Use search to reach the rest.
        </p>
      )}
    </ChartCard>
  );
};
