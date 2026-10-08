import type React from 'react';
import { Search } from 'lucide-react';
import { errorMessage } from '../../api/http';
import { CLASS_COLUMN, CLASS_LIMIT } from '../../lib/dax/daxBuilder';
import type { ClassRow, KpiFocus } from '../../lib/dax/types';
import { UdpPbiDataTable, type TableColumn } from '../powerbi-visuals';
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

/** Identifier first, status last; one renewal signal (a chip with the count, a dash for none). */
const COLUMNS: TableColumn[] = [
  { key: 'className', label: 'Asset Class' },
  { key: 'count', label: 'Inventory', kind: 'number' },
  { key: 'assessed', label: 'Condition Assessed', kind: 'meter', ratioKey: 'pctAssessed' },
  { key: 'dueForRenewal', label: 'Renewals', kind: 'status', suffix: 'due', tone: 'warn', emptyLabel: 'None due' },
];

function emptyMessage(search: string, kpiFocus: KpiFocus): string {
  if (search.trim()) return `No asset classes match "${search.trim()}" in this scope.`;
  if (kpiFocus === 'renewal') return 'No asset classes in this scope are due for renewal.';
  if (kpiFocus === 'assessed') return 'No asset classes in this scope have condition assessments.';
  return 'No asset classes matched the current cross-filters.';
}

/**
 * "Which exact classes?" — a table, because precision matters more than pattern here (principle 19).
 * Search and KPI focus run in the engine before TOPN; the box sits in the card header (`aside` slot).
 */
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
}) => (
  <UdpPbiDataTable
    index={index}
    className={className}
    visualId="classes"
    heading={`Asset Classes (${scopeLabel})`}
    subheading="Inventory, condition and renewals by class"
    label={`Asset classes (${scopeLabel})`}
    info={CHART_DEFINITIONS.classes.info}
    calc={CHART_DEFINITIONS.classes.calc}
    columns={COLUMNS}
    rows={(classes ?? []).map((c) => ({ ...c }))}
    rowKey="className"
    selectedValue={selectedClass}
    crossFilterField={CLASS_COLUMN}
    paginated={false}
    maxHeight={440}
    loading={isLoading}
    stale={isStale}
    error={error ? errorMessage(error) : undefined}
    emptyMessage={emptyMessage(search, kpiFocus)}
    exportFileName={`asset-classes-${scopeLabel}`}
    onDataPointClick={(e) => onToggleClass(String(e.detail.value))}
  >
    <label slot="aside" className="relative block flex-1 @md:flex-none">
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
    {classes && classes.length >= CLASS_LIMIT && (
      <p slot="footer" className="mt-2 text-[11px] text-u-label">
        Showing the top {CLASS_LIMIT} classes by inventory. Use search to reach the rest.
      </p>
    )}
  </UdpPbiDataTable>
);
