import type { CSSProperties, ReactElement } from 'react';
import type { DataPointClickDetail, DataPointValue, ExportFormat } from '@powerreact/udp-powerbi-visuals';
import type { DaxRow } from '../../lib/dax/types';
import type { GeoAsset } from '../../lib/geo/geoAssets';
import { keyLabel, type MappedData, type MappedDataMap } from '../../lib/manifest/mapRows';
import type { ManifestComponentName, ManifestVisual } from '../../lib/manifest/schema';
import {
  UdpPbiBoxplot,
  UdpPbiBulletBars,
  UdpPbiCalendarHeatmap,
  UdpPbiChoropleth,
  UdpPbiColumnChart,
  UdpPbiDataTable,
  UdpPbiDivergingBars,
  UdpPbiDonut,
  UdpPbiDotPlot,
  UdpPbiIbcsVariance,
  UdpPbiKpiBullet,
  UdpPbiKpiCard,
  UdpPbiKpiHero,
  UdpPbiKpiTrend,
  UdpPbiKpiVariance,
  UdpPbiMatrix,
  UdpPbiPointMap,
  UdpPbiRankingBars,
  UdpPbiScatter,
  UdpPbiSpotlightBars,
  UdpPbiStackedBars,
  UdpPbiTimeline,
  UdpPbiTreemap,
  UdpPbiTrendChart,
  UdpPbiWaterfall,
} from '../powerbi-visuals';
import { ChartCard } from '../ui/Card';
import { ManifestSlicer } from './ManifestSlicer';

/**
 * The components a manifest can name, mapped to the React wrappers of the udp-powerbi-visuals
 * elements. The names are the manifest contract with Univerus-Lens and stay as they are; the
 * elements follow UDP naming (`udp-pbi-*`). `satisfies` makes a missing or extra name a compile
 * error; registry.test.ts checks every name against the elements Stencil built (docs/components.json).
 */
export const REGISTRY = {
  UniverusKpiCard: UdpPbiKpiCard,
  UniverusKpiHero: UdpPbiKpiHero,
  UniverusSpotlightBars: UdpPbiSpotlightBars,
  UniverusRankingBars: UdpPbiRankingBars,
  UniverusBulletBars: UdpPbiBulletBars,
  UniverusDivergingBars: UdpPbiDivergingBars,
  UniverusDonut: UdpPbiDonut,
  UniverusTrendChart: UdpPbiTrendChart,
  UniverusIbcsVariance: UdpPbiIbcsVariance,
  UniverusDataTable: UdpPbiDataTable,
  UniverusColumnChart: UdpPbiColumnChart,
  UniverusStackedBars: UdpPbiStackedBars,
  UniverusScatter: UdpPbiScatter,
  UniverusMatrix: UdpPbiMatrix,
  UniverusWaterfall: UdpPbiWaterfall,
  UniverusTreemap: UdpPbiTreemap,
  UniverusCalendarHeatmap: UdpPbiCalendarHeatmap,
  UniverusDotPlot: UdpPbiDotPlot,
  UniverusTimeline: UdpPbiTimeline,
  UniverusBoxplot: UdpPbiBoxplot,
  UniverusKpiTrend: UdpPbiKpiTrend,
  UniverusKpiBullet: UdpPbiKpiBullet,
  UniverusKpiVariance: UdpPbiKpiVariance,
  UniverusPointMap: UdpPbiPointMap,
  UniverusChoropleth: UdpPbiChoropleth,
  // A control of the container (not a udp-powerbi-visuals element): in UDP, UdpDropdown / UdpTablist
  UniverusSlicer: ManifestSlicer,
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
  /** The selection on another of the visual's columns (a series, a matrix column). */
  selectionOn: (field: string | undefined) => DataPointValue | null;
  onDataPointClick: (event: CustomEvent<DataPointClickDetail>) => void;
  /** Slicers: the current selection on their column, and how to replace it. */
  slicerValues: DataPointValue[];
  onSlicerChange: (values: DataPointValue[], labels: string[]) => void;
  /** Maps: the boundary set named by `props.geo`, loaded from /geo. */
  geo?: GeoAsset;
  geoLoading?: boolean;
  geoError?: string;
}

/**
 * The host's raster basemap for `basemap: "tiles"` (UDP: its Azure Maps key). Unset by default:
 * maps draw the vector boundaries, free and offline.
 */
const HOST_TILES = import.meta.env.VITE_MAP_TILE_URL
  ? { url: String(import.meta.env.VITE_MAP_TILE_URL), attribution: String(import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? '') }
  : undefined;

/** Boundary props of a map from the resolved set (the manifest's object / key override the set's). */
function geoProps(ctx: VisualContext, geo: { object?: string; key?: string } | undefined) {
  const asset = ctx.geo;
  return {
    geometry: asset?.geometry,
    geometryObject: geo?.object ?? asset?.object,
    contextObject: asset?.context,
  };
}

/** Props every element takes: presentation from the manifest, state from the query, placement on the grid. */
/** Visuals drawn by a udp-powerbi-visuals element (every component but the container's slicer). */
type ElementVisual = Exclude<ManifestVisual, { component: 'UniverusSlicer' }>;

function commonProps(visual: ElementVisual, state: VisualState, index: number) {
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
function chartProps(visual: Exclude<ElementVisual, { component: 'UniverusKpiCard' | 'UniverusKpiHero' | 'UniverusKpiTrend' | 'UniverusKpiBullet' | 'UniverusKpiVariance' }>, state: VisualState, ctx: VisualContext) {
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
        <UdpPbiKpiCard
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
        <UdpPbiKpiHero
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
        <UdpPbiSpotlightBars
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
        <UdpPbiRankingBars
          {...chartProps(visual, state, ctx)}
          tableToggle={visual.props.tableView}
          data={dataOf(state, visual.component)?.data ?? []}
          topN={visual.props.topN}
          order={visual.props.order}
          mark={visual.props.mark}
        />
      );
    case 'UniverusBulletBars': {
      const p = visual.props;
      return (
        <UdpPbiBulletBars
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
        <UdpPbiDivergingBars
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
        <UdpPbiDonut
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
        <UdpPbiTrendChart
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          categories={d?.categories ?? []}
          series={d?.series ?? []}
          categoryTooltips={d?.categoryTooltips ?? []}
          area={p.area}
          directLabels={p.directLabels}
          gap={p.gap}
          goodWhen={p.goodWhen}
          referenceLines={p.referenceLines ?? []}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusIbcsVariance': {
      const p = visual.props;
      return (
        <UdpPbiIbcsVariance
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
        <UdpPbiDataTable
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
    case 'UniverusColumnChart': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      const emit = Boolean(visual.crossFilter?.emit);
      return (
        <UdpPbiColumnChart
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          categories={d?.categories ?? []}
          series={d?.series ?? []}
          seriesField={emit ? visual.fields.series : undefined}
          selectedSeries={ctx.selectionOn(visual.fields.series)}
          layout={p.layout}
          variant={p.variant}
          palette={p.palette}
          sort={p.sort}
          topN={p.topN || undefined}
          referenceLines={p.referenceLines ?? []}
          labels={p.labels}
          categoryLabel={p.categoryLabel ?? keyLabel(visual.fields.category)}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusStackedBars': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      const emit = Boolean(visual.crossFilter?.emit);
      return (
        <UdpPbiStackedBars
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          categories={d?.categories ?? []}
          series={d?.series ?? []}
          seriesField={emit ? visual.fields.series : undefined}
          selectedSeries={ctx.selectionOn(visual.fields.series)}
          layout={p.layout}
          palette={p.palette}
          negativeSeries={p.negativeSeries ?? []}
          neutralSeries={p.neutralSeries ?? []}
          sort={p.sort}
          topN={p.topN || undefined}
          labels={p.labels}
          categoryLabel={p.categoryLabel ?? keyLabel(visual.fields.category)}
        />
      );
    }
    case 'UniverusScatter': {
      const p = visual.props;
      const f = visual.fields;
      return (
        <UdpPbiScatter
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          points={dataOf(state, visual.component)?.points ?? []}
          xLabel={p.xLabel ?? keyLabel(f.x)}
          yLabel={p.yLabel ?? keyLabel(f.y)}
          sizeLabel={f.size ? (p.sizeLabel ?? keyLabel(f.size)) : undefined}
          xFormat={p.xFormat}
          sizeFormat={p.sizeFormat}
          xReference={p.xReference}
          yReference={p.yReference}
          quadrantLabels={p.quadrantLabels}
          xZero={p.xZero}
          yZero={p.yZero}
          labelTop={p.labelTop}
          categoryLabel={p.categoryLabel ?? keyLabel(f.category)}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusMatrix': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      const f = visual.fields;
      const emit = Boolean(visual.crossFilter?.emit);
      return (
        <UdpPbiMatrix
          {...chartProps(visual, state, ctx)}
          nodes={d?.nodes ?? []}
          columns={d?.columns ?? []}
          measures={d?.measures ?? []}
          grandTotal={d?.grandTotal}
          rowLevels={p.rowLevels ?? f.rows.map(keyLabel)}
          columnHeader={p.columnHeader ?? (f.column ? keyLabel(f.column) : undefined)}
          rowFields={emit ? f.rows : []}
          columnField={emit ? f.column : undefined}
          selectedColumn={ctx.selectionOn(f.column)}
          expandLevel={p.expandLevel}
          maxHeight={p.maxHeight}
        />
      );
    }
    case 'UniverusWaterfall': {
      const p = visual.props;
      return (
        <UdpPbiWaterfall
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          steps={dataOf(state, visual.component)?.steps ?? []}
          goodWhen={p.goodWhen}
          orientation={p.orientation}
          baseline={p.baseline}
          labels={p.labels}
          categoryLabel={p.categoryLabel ?? keyLabel(visual.fields.category)}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusTreemap': {
      const p = visual.props;
      const levels = visual.fields.levels;
      const emit = Boolean(visual.crossFilter?.emit);
      return (
        <UdpPbiTreemap
          {...chartProps(visual, state, ctx)}
          // An item selection highlights the item, a group selection the group
          selectedValue={ctx.selectionOn(levels[1]) ?? ctx.selectionOn(levels[0])}
          tableToggle={p.tableView}
          nodes={dataOf(state, visual.component)?.nodes ?? []}
          levelFields={emit ? levels : []}
          colorLabel={p.colorLabel ?? (visual.fields.color ? keyLabel(visual.fields.color) : undefined)}
          colorFormat={p.colorFormat}
          colorScale={p.colorScale}
          goodWhen={p.goodWhen}
          colorCenter={p.colorCenter}
          levelLabels={p.levelLabels ?? levels.map(keyLabel)}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusCalendarHeatmap': {
      const p = visual.props;
      return (
        <UdpPbiCalendarHeatmap
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          days={dataOf(state, visual.component)?.days ?? []}
          valueLabel={p.valueLabel ?? keyLabel(visual.fields.value)}
          weekStart={p.weekStart}
        />
      );
    }
    case 'UniverusDotPlot': {
      const p = visual.props;
      return (
        <UdpPbiDotPlot
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          items={dataOf(state, visual.component)?.items ?? []}
          variant={p.variant}
          fromLabel={p.fromLabel}
          toLabel={p.toLabel}
          goodWhen={p.goodWhen}
          sort={p.sort}
          categoryLabel={p.categoryLabel ?? keyLabel(visual.fields.category)}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusTimeline': {
      const p = visual.props;
      const f = visual.fields;
      return (
        <UdpPbiTimeline
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          tasks={dataOf(state, visual.component)?.tasks ?? []}
          today={p.today}
          toneLabels={p.toneLabels ?? {}}
          categoryLabel={p.categoryLabel ?? keyLabel(f.item)}
          laneLabel={p.laneLabel ?? (f.lane ? keyLabel(f.lane) : undefined)}
        />
      );
    }
    case 'UniverusBoxplot': {
      const p = visual.props;
      return (
        <UdpPbiBoxplot
          {...chartProps(visual, state, ctx)}
          tableToggle={p.tableView}
          items={dataOf(state, visual.component)?.items ?? []}
          showMean={p.showMean}
          zero={p.zero}
          categoryLabel={p.categoryLabel ?? keyLabel(visual.fields.category)}
        />
      );
    }
    case 'UniverusKpiTrend': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UdpPbiKpiTrend
          {...commonProps(visual, state, ctx.index)}
          series={d?.series ?? []}
          value={d?.value}
          comparisonValue={d?.comparisonValue}
          target={d?.target}
          goodWhen={p.goodWhen}
          deltaLabel={p.deltaLabel}
          targetLabel={p.targetLabel}
          periodLabel={p.periodLabel}
          icon={p.icon}
          caption={p.caption}
        />
      );
    }
    case 'UniverusKpiBullet': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UdpPbiKpiBullet
          {...commonProps(visual, state, ctx.index)}
          value={d?.value}
          target={d?.target}
          forecast={d?.forecast}
          thresholds={p.thresholds}
          max={p.max}
          goodWhen={p.goodWhen}
          targetLabel={p.targetLabel}
          forecastLabel={p.forecastLabel}
          statusLabels={p.statusLabels ?? {}}
          icon={p.icon}
          caption={p.caption}
        />
      );
    }
    case 'UniverusKpiVariance': {
      const d = dataOf(state, visual.component);
      const p = visual.props;
      return (
        <UdpPbiKpiVariance
          {...commonProps(visual, state, ctx.index)}
          actual={d?.actual}
          comparison={d?.comparison}
          scenario={p.scenario}
          goodWhen={p.goodWhen}
          actualLabel={p.actualLabel}
          comparisonLabel={p.comparisonLabel}
          decimals={p.decimals}
          icon={p.icon}
          caption={p.caption}
        />
      );
    }
    case 'UniverusPointMap': {
      const p = visual.props;
      const f = visual.fields;
      const base = chartProps(visual, state, ctx);
      return (
        <UdpPbiPointMap
          {...base}
          {...geoProps(ctx, p.geo)}
          loading={base.loading || Boolean(ctx.geoLoading)}
          error={base.error ?? ctx.geoError}
          tableToggle={p.tableView}
          points={dataOf(state, visual.component)?.points ?? []}
          mark={p.mark}
          projection={p.projection}
          tiles={p.basemap === 'tiles' ? HOST_TILES : undefined}
          categoryLabel={p.categoryLabel ?? keyLabel(f.category)}
          valueLabel={p.valueLabel ?? (f.value ? keyLabel(f.value) : 'Value')}
          groupLabel={p.groupLabel ?? (f.group ? keyLabel(f.group) : 'Group')}
          zoomable={p.zoomable}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusChoropleth': {
      const p = visual.props;
      const f = visual.fields;
      const base = chartProps(visual, state, ctx);
      return (
        <UdpPbiChoropleth
          {...base}
          {...geoProps(ctx, p.geo)}
          loading={base.loading || Boolean(ctx.geoLoading)}
          error={base.error ?? ctx.geoError}
          tableToggle={p.tableView}
          regions={dataOf(state, visual.component)?.regions ?? []}
          featureKey={p.geo.key ?? ctx.geo?.key ?? 'code'}
          tileLayout={ctx.geo?.tileLayout}
          colorScale={p.colorScale}
          classes={p.classes}
          classCount={p.classCount}
          goodWhen={p.goodWhen}
          colorCenter={p.colorCenter}
          shape={p.shape}
          projection={p.projection}
          fit={p.fit}
          labels={p.labels}
          regionLabel={p.regionLabel ?? keyLabel(f.region)}
          valueLabel={p.valueLabel ?? keyLabel(f.value)}
          zoomable={p.zoomable}
          chartHeight={p.chartHeight}
        />
      );
    }
    case 'UniverusSlicer': {
      const p = visual.props;
      return (
        <div
          className="u-mgrid__cell"
          style={{ '--u-col-span': String(visual.grid.colSpan), '--u-row-span': String(visual.grid.rowSpan) } as CSSProperties}
          data-compact={visual.grid.colSpan <= 3 ? '' : undefined}
        >
          <ChartCard title={p.title} subtitle={p.subtitle} info={p.info} index={ctx.index} className="h-full" data-testid={`${visual.id}-card`}>
            <ManifestSlicer
              label={p.title}
              options={dataOf(state, visual.component)?.options ?? []}
              selected={ctx.slicerValues}
              mode={p.mode}
              multiple={p.multiple}
              allLabel={p.allLabel}
              onChange={ctx.onSlicerChange}
              loading={state.loading}
              error={state.error}
              testId={visual.id}
            />
          </ChartCard>
        </div>
      );
    }
  }
}
