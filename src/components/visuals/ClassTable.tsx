import type React from 'react';
import { CheckCircle, Layers, Search } from 'lucide-react';
import { CLASS_LIMIT } from '../../lib/dax/daxBuilder';
import type { ClassRow, KpiFocus } from '../../lib/dax/types';
import { ErrorNote, LoadingNote } from './StatusNote';

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
}

function emptyMessage(search: string, kpiFocus: KpiFocus): string {
  if (search.trim()) return `No asset classes match "${search.trim()}" in this scope.`;
  if (kpiFocus === 'renewal') return 'No asset classes in this scope are due for renewal.';
  if (kpiFocus === 'assessed') return 'No asset classes in this scope have condition assessments.';
  return 'No asset classes matched the current cross-filters.';
}

const FullWidthRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr>
    <td colSpan={5} className="p-3">
      {children}
    </td>
  </tr>
);

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
}) => {
  let rows: React.ReactNode;
  if (!classes) {
    rows = error ? (
      <FullWidthRow>
        <ErrorNote error={error} />
      </FullWidthRow>
    ) : isLoading ? (
      <FullWidthRow>
        <LoadingNote />
      </FullWidthRow>
    ) : null;
  } else if (classes.length === 0) {
    rows = (
      <tr>
        <td colSpan={5} className="py-12 text-center text-slate-400">
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
          className={`transition-colors cursor-pointer select-none focus:outline-none focus-visible:bg-slate-100 ${
            isSelected
              ? 'bg-indigo-50/80 font-semibold text-indigo-900 border-l-4 border-l-indigo-600'
              : 'hover:bg-slate-50/80'
          }`}
        >
          <td className="py-2.5 px-3 flex items-center gap-2">
            {isSelected && <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
            <span className={isSelected ? 'text-indigo-950 font-bold' : 'text-slate-900 font-medium'}>
              {cls.className}
            </span>
          </td>
          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
            {cls.count.toLocaleString()}
          </td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
            {cls.assessed.toLocaleString()}{' '}
            <span className="text-[10px] text-slate-400">({(cls.pctAssessed * 100).toFixed(0)}%)</span>
          </td>
          <td className="py-2.5 px-3 text-right font-mono">
            {cls.dueForRenewal > 0 ? (
              <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                {cls.dueForRenewal.toLocaleString()}
              </span>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </td>
          <td className="py-2.5 px-3 text-center">
            {cls.dueForRenewal > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Renewal
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Healthy
              </span>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-teal-600" />
            Asset Classes ({scopeLabel})
          </h3>
          <p className="text-xs text-slate-500">⚡ Click any row to cross-filter KPIs down to that specific class</p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search classes in model..."
            aria-label="Search asset classes"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-200 focus:outline-none focus:border-teal-500 w-48 bg-slate-50"
          />
        </div>
      </div>

      {classes && error ? (
        <div className="mb-3">
          <ErrorNote error={error} />
        </div>
      ) : null}

      <div
        className={`flex-1 overflow-y-auto max-h-[440px] rounded-lg border border-slate-200 transition-opacity ${
          isStale ? 'opacity-60' : ''
        }`}
      >
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 font-semibold z-10">
            <tr>
              <th className="py-2.5 px-3">Asset Class</th>
              <th className="py-2.5 px-3 text-right">Inventory</th>
              <th className="py-2.5 px-3 text-right">Condition Assessed</th>
              <th className="py-2.5 px-3 text-right">Renewal Due</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">{rows}</tbody>
        </table>
      </div>

      {classes && classes.length >= CLASS_LIMIT && (
        <p className="text-[11px] text-slate-400 mt-2">
          Showing the top {CLASS_LIMIT} classes by inventory. Use search to reach the rest.
        </p>
      )}
    </div>
  );
};
