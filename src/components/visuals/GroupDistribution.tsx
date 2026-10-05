import type React from 'react';
import type { GroupRow } from '../../lib/dax/types';
import { SpotlightBars } from '../charts/SpotlightBars';
import { formatPercent } from '../charts/layout/format';
import { ChartCard } from '../ui/Card';
import { cx } from '../ui/cx';
import { EmptyState, ErrorNote, LoadingState } from '../ui/primitives';
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

type GroupDatum = GroupRow & { id: string; label: string; value: number };

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
}) => {
  const data: GroupDatum[] = (groups ?? []).map((g) => ({ ...g, id: g.group, label: g.group, value: g.count }));

  let body: React.ReactNode;
  if (!groups) {
    body = error ? <ErrorNote error={error} /> : isLoading ? <LoadingState rows={4} /> : null;
  } else if (groups.length === 0) {
    body = <EmptyState>No asset groups returned for the current cross-filters.</EmptyState>;
  } else {
    body = (
      <SpotlightBars
        data={data}
        label="Asset distribution by group"
        selectedId={selectedGroup}
        onSelect={(d) => onToggleGroup(d.group)}
        selectedBadge="Cross-Filtered"
        testIdPrefix="group"
        secondary={(row) => `(${formatPercent(row.share, 1)})`}
        renderMeta={(g) => (
          <span className="flex justify-between gap-3">
            <span>
              Assessed <b className="font-semibold text-u-text-soft">{g.assessed.toLocaleString()}</b> (
              {(g.pctAssessed * 100).toFixed(0)}%)
            </span>
            <span>
              Renewal{' '}
              <b className={cx('font-semibold', g.dueForRenewal > 0 ? 'text-u-warn-text' : 'text-u-text-soft')}>
                {g.dueForRenewal.toLocaleString()}
              </b>
            </span>
          </span>
        )}
      />
    );
  }

  return (
    <ChartCard
      title="Asset Distribution by Group"
      subtitle="Asset count and share of the register"
      aside={<span className="u-num text-[11px] text-u-label">{groups?.length ?? 0} groups</span>}
      info={CHART_DEFINITIONS.groups.info}
      calc={CHART_DEFINITIONS.groups.calc}
      index={index}
      className={className}
      bodyClassName={cx('transition-opacity', isStale && 'opacity-60')}
    >
      {groups && error ? (
        <div className="mb-3">
          <ErrorNote error={error} />
        </div>
      ) : null}
      {body}
    </ChartCard>
  );
};
