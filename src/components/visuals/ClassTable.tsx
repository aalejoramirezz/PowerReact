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
  <tr>
    <td colSpan={5} className="!h-auto p-3">
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
      <tr>
        <td colSpan={5} className="!h-auto py-12 text-center text-u-label">
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
          aria-selected={isSelected}
          data-interactive="true"
          className="select-none"
        >
          <td>
            <span className="flex items-center gap-2">
              {isSelected && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-u-interaction" />}
              <span className={cx('text-u-title', isSelected ? 'font-bold' : 'font-medium')}>{cls.className}</span>
            </span>
          </td>
          <td className="u-num text-right font-semibold text-u-title">{cls.count.toLocaleString()}</td>
          <td>
            <span className="flex items-center justify-end gap-2.5">
              <span className="u-num">{cls.assessed.toLocaleString()}</span>
              <MiniMeter value={cls.pctAssessed} className="w-14" />
              <span className="u-num w-9 text-right text-[11px] text-u-label">{(cls.pctAssessed * 100).toFixed(0)}%</span>
            </span>
          </td>
          <td className="text-right">
            {cls.dueForRenewal > 0 ? (
              <StatusChip tone="warn" className="u-num">
                {cls.dueForRenewal.toLocaleString()}
              </StatusChip>
            ) : (
              <span className="u-num text-u-label">0</span>
            )}
          </td>
          <td className="text-center">
            {cls.dueForRenewal > 0 ? <StatusChip tone="warn">Renewal</StatusChip> : <StatusChip tone="ok">Healthy</StatusChip>}
          </td>
        </tr>
      );
    });
  }

  return (
    <ChartCard
      title={`Asset Classes (${scopeLabel})`}
      subtitle="Click a row to cross-filter the KPIs down to that class"
      info={CHART_DEFINITIONS.classes.info}
      calc={CHART_DEFINITIONS.classes.calc}
      aside={
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-label" />
          <input
            type="search"
            placeholder="Search classes in model..."
            aria-label="Search asset classes"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="u-input w-52 pl-8"
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
        <table className="u-table">
          <thead>
            <tr>
              <th>Asset Class</th>
              <th className="!text-right">Inventory</th>
              <th className="!text-right">Condition Assessed</th>
              <th className="!text-right">Renewal Due</th>
              <th className="!text-center">Status</th>
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
