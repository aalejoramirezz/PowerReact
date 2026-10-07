import type React from 'react';
import { errorMessage } from '../../api/http';
import { GROUP_COLUMN } from '../../lib/dax/daxBuilder';
import type { GroupRow } from '../../lib/dax/types';
import { UniverusSpotlightBars, type BarItem } from '../univerus';
import { CHART_DEFINITIONS } from './kpiDefinitions';

interface GroupDistributionProps {
  groups: GroupRow[] | undefined;
  selectedGroup: string | null;
  onToggleGroup: (group: string) => void;
  isLoading: boolean;
  isStale: boolean;
  error: unknown;
  index?: number;
  className?: string;
}

const toBar = (g: GroupRow): BarItem => ({
  id: g.group,
  label: g.group,
  value: g.count,
  raw: g.group,
  meta: [
    { label: 'Assessed', value: g.assessed.toLocaleString(), note: `(${(g.pctAssessed * 100).toFixed(0)}%)` },
    { label: 'Renewal', value: g.dueForRenewal.toLocaleString(), tone: g.dueForRenewal > 0 ? 'warn' : undefined },
  ],
});

/** "Which group leads?" as spotlight bars; clicking a group cross-filters KPIs and classes. */
export const GroupDistribution: React.FC<GroupDistributionProps> = ({
  groups,
  selectedGroup,
  onToggleGroup,
  isLoading,
  isStale,
  error,
  index = 0,
  className,
}) => (
  <UniverusSpotlightBars
    index={index}
    className={className}
    visualId="groups"
    heading="Asset Distribution by Group"
    subheading="Asset count and share of the register"
    label="Asset distribution by group"
    info={CHART_DEFINITIONS.groups.info}
    calc={CHART_DEFINITIONS.groups.calc}
    data={(groups ?? []).map(toBar)}
    secondary="share-paren"
    selectedValue={selectedGroup}
    selectedBadge="Cross-Filtered"
    crossFilterField={GROUP_COLUMN}
    testIdPrefix="group"
    loading={isLoading}
    stale={isStale}
    error={error ? errorMessage(error) : undefined}
    emptyMessage="No asset groups returned for the current cross-filters."
    exportFileName="asset-distribution-by-group"
    onDataPointClick={(e) => onToggleGroup(String(e.detail.value))}
  >
    <span slot="aside" className="u-num text-[11px] text-u-label">
      {groups?.length ?? 0} groups
    </span>
  </UniverusSpotlightBars>
);
