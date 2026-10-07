import type { CSSProperties, ReactElement } from 'react';
import type { DataPointClickDetail, DataPointValue, ExportFormat } from '@powerreact/univerus-elements';
import type { DaxRow } from '../../lib/dax/types';
import type { MappedData, MappedDataMap } from '../../lib/manifest/mapRows';
import type { ManifestComponentName, ManifestVisual } from '../../lib/manifest/schema';
import {
  UniverusBulletBars,
  UniverusDataTable,
  UniverusDivergingBars,
  UniverusDonut,
  UniverusIbcsVariance,
  UniverusKpiCard,
  UniverusKpiHero,
  UniverusRankingBars,
  UniverusSpotlightBars,
  UniverusTrendChart,
} from '../univerus';

/**
 * The components a manifest can name, mapped to their React wrappers. `satisfies` makes a missing or
 * extra name a compile error; registry.test.ts checks every name against the elements Stencil built
 * (docs/components.json: tag, props, events).
 */
export const REGISTRY = {
  UniverusKpiCard,
  UniverusKpiHero,
  UniverusSpotlightBars,
  UniverusRankingBars,
  UniverusBulletBars,
  UniverusDivergingBars,
  UniverusDonut,
  UniverusTrendChart,
  UniverusIbcsVariance,
  UniverusDataTable,
} satisfies Record<ManifestComponentName, unknown>;

export interface VisualState {
  loading: boolean;
  stale: boolean;
  error?: string;
  /** The raw query rows (exported when the manifest asks for `export.source: "query"`). */
  rows?: DaxRow[];
  data?: MappedData;
}

export interface VisualContext {
  index: number;
  selectedValue: DataPointValue | null;
  onDataPointClick: (event: CustomEvent<DataPointClickDetail>) => void;
}

/** Props every element takes: presentation from the manifest, state from the query, placement on the grid. */
function commonProps(visual: ManifestVisual, state: VisualState, index: number) {
  const p = visual.props;
  const exp = p.export;
  const formats: ExportFormat[] = [...(exp?.csv === false ? [] : ['csv' as const]), ...(exp?.xlsx === false ? [] : ['xlsx' as const])];
  return {
    visualId: visual.id,
    index,
    heading: p.title,
    info: p.info,
    calc: p.calc,
    format: p.format,
    loading: state.loading,
    stale: state.stale,
    error: state.error,
    exportable: formats.length > 0,
    exportFormats: formats,
    exportFileName: exp?.fileName ?? visual.id,
    exportRows: exp?.source === 'query' ? state.rows : undefined,
    focusable: p.focusMode,
    theme: p.theme,
    // Placement on the manifest's 12-column grid (manifest.css)
    className: 'u-mgrid__cell',
    style: { '--u-col-span': String(visual.grid.colSpan), '--u-row-span': String(visual.grid.rowSpan) } as CSSProperties,
    'data-compact': visual.grid.colSpan <= 3 ? '' : undefined,
  };
}

/** Charts and tables add the subtitle, the empty message and cross-filtering. */
function chartProps(visual: Exclude<ManifestVisual, { component: 'UniverusKpiCard' | 'UniverusKpiHero' }>, state: VisualState, ctx: VisualContext) {
  return {
    ...commonProps(visual, state, ctx.index),
    subheading: visual.props.subtitle,
    emptyMessage: visual.props.emptyMessage,
    crossFilterField: visual.crossFilter?.field,
    interactive: Boolean(visual.crossFilter?.emit),
    selectedValue: ctx.selectedValue,
    testIdPrefix: visual.id,
    onDataPointClick: ctx.onDataPointClick,
  };
}

const dataOf = <C extends ManifestComponentName>(state: VisualState, _component: C) => state.data as MappedDataMap[C] | undefined;

/** Renders one manifest visual with its element. */
export function renderVisual(visual: ManifestVisual, state: VisualState, ctx: VisualContext): ReactElement {
  switch (visual.component) {
    case 'UniverusKpiCard': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UniverusKpiCard
          {...commonProps(visual, state, ctx.index)}
          value={d?.value}
          comparisonValue={d?.comparisonValue}
          goodWhen={p.goodWhen}
          deltaLabel={p.deltaLabel}
          icon={p.icon}
          caption={p.caption}
          meter={d && d.meterValue !== null ? { value: d.meterValue, label: p.meterLabel, detail: p.meterDetail } : undefined}
        />
      );
    }
    case 'UniverusKpiHero': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UniverusKpiHero
          {...commonProps(visual, state, ctx.index)}
          value={d?.value}
          comparisonValue={d?.comparisonValue}
          goodWhen={p.goodWhen}
          deltaLabel={p.deltaLabel}
          unit={p.unit}
          metrics={d?.metrics ?? []}
          meter={d && d.meterValue !== null ? { label: p.meterLabel ?? 'Meter', value: d.meterValue } : undefined}
        />
      );
    }
    case 'UniverusSpotlightBars': {
      const p = visual.props;
      return (
        <UniverusSpotlightBars
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          topN={p.topN}
          rank={p.rank}
          secondary={p.secondary}
          selectedBadge={p.selectedBadge}
        />
      );
    }
    case 'UniverusRankingBars':
      return (
        <UniverusRankingBars
          {...chartProps(visual, state, ctx)}
          tableToggle={visual.props.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          topN={visual.props.topN}
          order={visual.props.order}
        />
      );
    case 'UniverusBulletBars': {
      const p = visual.props;
      return (
        <UniverusBulletBars
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          goodWhen={p.goodWhen}
          topN={p.topN}
          targetLabel={p.targetLabel}
        />
      );
    }
    case 'UniverusDivergingBars': {
      const p = visual.props;
      return (
        <UniverusDivergingBars
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          negativeLabel={p.negativeLabel}
          positiveLabel={p.positiveLabel}
          maxRows={p.maxRows}
        />
      );
    }
    case 'UniverusDonut':
      return (
        <UniverusDonut
          {...chartProps(visual, state, ctx)}
          tableToggle={visual.props.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          centerLabel={visual.props.centerLabel}
        />
      );
    case 'UniverusTrendChart': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UniverusTrendChart
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          categories={d?.categories ?? []}
          series={d?.series ?? []}
          area={p.area}
          directLabels={p.directLabels}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusIbcsVariance': {
      const p = visual.props;
      return (
        <UniverusIbcsVariance
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          orientation={p.orientation}
          scenario={p.scenario}
          goodWhen={p.goodWhen}
          actualLabel={p.actualLabel}
          comparisonLabel={p.comparisonLabel}
          sort={p.sort}
          topN={p.topN}
          pctCap={p.pctCap}
          decimals={p.decimals}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusDataTable': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UniverusDataTable
          {...chartProps(visual, state, ctx)}
          columns={d?.columns ?? []}
          rows={d?.rows ?? []}
          rowKey={d?.rowKey}
          paginated={p.paginated}
          pageSize={p.pageSize}
          maxHeight={p.maxHeight}
        />
      );
    }
  }
}
