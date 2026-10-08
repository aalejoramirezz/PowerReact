import React, { useMemo } from 'react';
import type { DataPointClickDetail } from '@powerreact/udp-powerbi-visuals';
import { errorMessage } from '../../api/http';
import { useSemanticQuery } from '../../hooks/useSemanticQuery';
import { appliedFilters, sampleRows, selectionOf, selectionOn, slicerValuesOf, type CrossFilter } from '../../lib/manifest/crossFilters';
import { injectCrossFilters } from '../../lib/manifest/daxInjection';
import { mapRows } from '../../lib/manifest/mapRows';
import type { Manifest, ManifestVisual as ManifestVisualSpec } from '../../lib/manifest/schema';
import { selectCrossFilters, useFilterStore } from '../../store/filters';
import { renderVisual, type VisualContext, type VisualState } from './registry';

export type DataSourceMode = 'live' | 'sample';

interface ManifestVisualProps {
  manifest: Manifest;
  visual: ManifestVisualSpec;
  index: number;
}

/**
 * A click on the visual toggles its selection (when the manifest lets it emit one). A mark with
 * several dimensions (a matrix cell, a stacked segment) reports them all in `filters`.
 */
function useClickToFilter(manifest: Manifest, visual: ManifestVisualSpec) {
  const toggle = useFilterStore((s) => s.toggleCrossFilter);
  return (event: CustomEvent<DataPointClickDetail>) => {
    const cf = visual.crossFilter;
    const { value, label, filters } = event.detail;
    if (!cf?.emit) return;
    const points = filters?.length ? filters : value === null ? [] : [{ field: cf.field, value, label }];
    toggle(manifest.id, visual.id, points);
  };
}

/** Selection state and handlers a visual renders with (highlights, series and matrix columns, slicers). */
function useVisualContext(
  manifest: Manifest,
  visual: ManifestVisualSpec,
  filters: readonly CrossFilter[],
  index: number,
  onDataPointClick: VisualContext['onDataPointClick']
): VisualContext {
  const setSlicer = useFilterStore((s) => s.setSlicerFilter);
  return {
    index,
    selectedValue: selectionOf(visual, filters),
    selectionOn: (field) => selectionOn(filters, field),
    onDataPointClick,
    slicerValues: slicerValuesOf(visual, filters),
    onSlicerChange: (values, labels) => {
      if (visual.component !== 'UniverusSlicer') return;
      setSlicer(manifest.id, { field: visual.fields.value, values, labels, sourceVisualId: visual.id });
    },
  };
}

/**
 * Live: the manifest's DAX against its own semantic model, with the dashboard's cross-filters
 * injected (CALCULATETABLE + TREATAS). The DAX text is the cache key, as for every visual.
 */
const LiveVisual: React.FC<ManifestVisualProps> = ({ manifest, visual, index }) => {
  const filters = useFilterStore(selectCrossFilters(manifest.id));
  const onDataPointClick = useClickToFilter(manifest, visual);
  const empty = useMemo(() => mapRows(visual, []), [visual]);

  let dax = visual.query.dax;
  let injectError: string | undefined;
  try {
    dax = injectCrossFilters(visual.query.dax, appliedFilters(visual, filters));
  } catch (error) {
    injectError = errorMessage(error);
  }

  const query = useSemanticQuery({
    kind: `manifest:${manifest.id}:${visual.id}`,
    title: `${visual.props.title} (manifest)`,
    dax,
    parse: (rows) => ({ rows, data: mapRows(visual, rows) }),
    target: { workspaceId: manifest.dataSource.workspaceId, datasetId: manifest.dataSource.semanticModelId },
  });

  const state: VisualState = {
    loading: query.isPending,
    stale: query.isPlaceholderData,
    error: injectError ?? (query.error ? errorMessage(query.error) : undefined),
    rows: query.data?.rows,
    data: query.data?.data ?? empty,
  };
  return renderVisual(visual, state, useVisualContext(manifest, visual, filters, index, onDataPointClick));
};

/** Sample: the manifest's own `sample` rows, filtered in the browser. No network at all. */
const SampleVisual: React.FC<ManifestVisualProps> = ({ manifest, visual, index }) => {
  const filters = useFilterStore(selectCrossFilters(manifest.id));
  const onDataPointClick = useClickToFilter(manifest, visual);
  const result = useMemo(() => {
    const rows = sampleRows(visual, appliedFilters(visual, filters));
    return { rows, data: mapRows(visual, rows) };
  }, [visual, filters]);

  const state: VisualState = {
    loading: false,
    stale: false,
    error: visual.sample ? undefined : 'This visual has no sample rows: switch to Live to query the model.',
    rows: result.rows,
    data: result.data,
  };
  return renderVisual(visual, state, useVisualContext(manifest, visual, filters, index, onDataPointClick));
};

/** One visual of a manifest dashboard. Changing `source` swaps the component, so hooks never change order. */
export const ManifestVisual: React.FC<ManifestVisualProps & { source: DataSourceMode }> = ({ source, ...props }) =>
  source === 'live' ? <LiveVisual {...props} /> : <SampleVisual {...props} />;
