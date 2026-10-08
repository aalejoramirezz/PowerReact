import React, { useMemo } from 'react';
import type { DataPointValue } from '@powerreact/udp-powerbi-visuals';
import { errorMessage } from '../../api/http';
import { useSemanticQuery } from '../../hooks/useSemanticQuery';
import type { DaxRow } from '../../lib/dax/types';
import { optionFilters, reportFilterId, reportFilterValues, sampleColumnValues } from '../../lib/manifest/crossFilters';
import { columnValuesQuery, injectCrossFilters } from '../../lib/manifest/daxInjection';
import { categoryLabel, normalizeKey, normalizeRow, type SlicerOption } from '../../lib/manifest/mapRows';
import type { Manifest } from '../../lib/manifest/schema';
import { selectCrossFilters, useFilterStore } from '../../store/filters';
import { ManifestSlicer } from './ManifestSlicer';
import type { DataSourceMode } from './ManifestVisual';

type ReportFilter = NonNullable<Manifest['filters']>[number];

interface FilterProps {
  manifest: Manifest;
  filter: ReportFilter;
  index: number;
}

const toOption = (value: unknown): SlicerOption => {
  const raw = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
  return { id: categoryLabel(value), label: categoryLabel(value), raw, count: null };
};

/** The selection and its update: one slicer filter per report filter, replaced as a whole. */
function useReportFilter(manifest: Manifest, filter: ReportFilter, index: number) {
  const filters = useFilterStore(selectCrossFilters(manifest.id));
  const setSlicer = useFilterStore((s) => s.setSlicerFilter);
  return {
    filters,
    selected: reportFilterValues(index, filters),
    onChange: (values: DataPointValue[], labels: string[]) =>
      setSlicer(manifest.id, { field: filter.field, values, labels, sourceVisualId: reportFilterId(index) }),
  };
}

const Control: React.FC<FilterProps & { options: SlicerOption[]; selected: DataPointValue[]; onChange: (v: DataPointValue[], l: string[]) => void; loading?: boolean; error?: string }> = ({
  filter,
  index,
  ...rest
}) => (
  <ManifestSlicer
    label={filter.label}
    mode={filter.mode}
    multiple={filter.multiple}
    allLabel="All"
    testId={`report-filter-${index}`}
    {...rest}
  />
);

/** Live: the options query (the manifest's, or the column's values) with the other filters injected. */
const LiveReportFilter: React.FC<FilterProps> = (props) => {
  const { manifest, filter, index } = props;
  const { filters, selected, onChange } = useReportFilter(manifest, filter, index);
  let dax = filter.dax ?? columnValuesQuery(filter.field);
  let injectError: string | undefined;
  try {
    dax = injectCrossFilters(dax, optionFilters(filter.field, filters));
  } catch (error) {
    injectError = errorMessage(error);
  }
  const key = normalizeKey(filter.field);
  const query = useSemanticQuery({
    kind: `manifest:${manifest.id}:filter:${index}`,
    title: `${filter.label} (report filter)`,
    dax,
    parse: (rows: DaxRow[]) => rows.map((r) => toOption(normalizeRow(r)[key])),
    target: { workspaceId: manifest.dataSource.workspaceId, datasetId: manifest.dataSource.semanticModelId },
  });
  return (
    <Control
      {...props}
      options={query.data ?? []}
      selected={selected}
      onChange={onChange}
      loading={query.isPending}
      error={injectError ?? (query.error ? errorMessage(query.error) : undefined)}
    />
  );
};

/** Sample: the column's distinct values in the visuals' sample rows. */
const SampleReportFilter: React.FC<FilterProps> = (props) => {
  const { manifest, filter, index } = props;
  const { filters, selected, onChange } = useReportFilter(manifest, filter, index);
  const options = useMemo(() => sampleColumnValues(manifest.visuals, filter.field, filters).map(toOption), [manifest.visuals, filter.field, filters]);
  return <Control {...props} options={options} selected={selected} onChange={onChange} />;
};

/**
 * The manifest's report filters (Lens `report_filters`), drawn in the dashboard toolbar. Each is a
 * slicer on a model column: it filters every visual, and its control shows the selection (no chip).
 */
export const ManifestFilterBar: React.FC<{ manifest: Manifest; source: DataSourceMode }> = ({ manifest, source }) => {
  if (!manifest.filters?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="manifest-report-filters">
      {manifest.filters.map((filter, index) =>
        source === 'live' ? (
          <LiveReportFilter key={`${index}:${filter.field}`} manifest={manifest} filter={filter} index={index} />
        ) : (
          <SampleReportFilter key={`${index}:${filter.field}`} manifest={manifest} filter={filter} index={index} />
        )
      )}
    </div>
  );
};
