import { Component, Element, Event, h, Host, Prop, State, type EventEmitter, type VNode } from '@stencil/core';
import { geoPath } from 'd3-geo';
import type { Feature, MultiLineString } from 'geojson';
import { ChartTooltip, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import {
  applyView,
  ClassLegend,
  GlobeDrag,
  IDENTITY_VIEW,
  MapBase,
  MapBorders,
  MapControls,
  MapZoom,
  NoDataPattern,
  RampLegend,
  type ClassSwatch,
  type MapView,
} from '../../../functional/map-kit';
import { chartLabel, emitClick, isInteractive } from '../../../utils/data';
import {
  sameValue,
  type DataPointClickDetail,
  type DataPointValue,
  type ExportDetail,
  type ExportFormat,
  type FocusModeDetail,
  type ThemeName,
  type ViewChangeDetail,
} from '../../../utils/events';
import { formatter, type FormatSpec } from '../../../utils/formats';
import {
  borders,
  classBreaks,
  classIndex,
  featureKey,
  fitProjection,
  globeRotation,
  mapStep,
  mapSteps,
  matchRegions,
  normKey,
  tilePositions,
  toFeatures,
  type ClassMode,
  type GeometryInput,
  type ProjectionName,
  type RegionValue,
} from '../../../utils/layout/geo';
import { divergingStep, extent } from '../../../utils/layout/scales';
import { rampColour } from '../../../utils/palette';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

/** A region with its value, its feature (when the boundaries have it) and its rank by value. */
interface Shaded {
  r: RegionValue;
  name: string;
  /** Tile key (ISO 3166-2), when known. */
  code: string;
  fi: number | null;
}

const LABEL_AREA = 2200;

/**
 * Choropleth (FT "spatial"): regions coloured by a rate or a ratio. Never shade raw counts — larger
 * regions would win by size alone; a count belongs on a point map's bubbles or spikes. Classes are
 * equal intervals (`quantize`), equal counts (`quantile`) or a continuous 7-step ramp; `diverging`
 * colours around `colorCenter`, favourable side by `goodWhen`. `shape="tiles"` is an equal-area
 * cartogram (every region one tile, from `tileLayout`), `projection="globe"` an orthographic globe.
 * Regions the boundaries do not know are listed under the map, never dropped silently.
 */
@Component({
  tag: 'udp-pbi-choropleth',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/charts.css',
    '../../../styles/maps.css',
    'udp-pbi-choropleth.css',
  ],
  shadow: true,
})
export class UdpPbiChoropleth {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  @Prop() heading = '';
  @Prop() subheading?: string;
  @Prop() label?: string;
  @Prop() info?: string;
  @Prop() calc?: string;
  /** Format of the values. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected region (its raw value or key). */
  @Prop() selectedValue?: DataPointValue | null;
  @Prop() crossFilterField?: string;
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() tableToggle = true;
  @Prop() theme?: ThemeName;
  @Prop() frame: VisualFrameMode = 'card';
  /** data-testid prefix: `${p}-region-${key}`. */
  @Prop() testIdPrefix?: string;
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** One value per region. */
  @Prop() regions: RegionValue[] = [];
  /** The boundaries: a TopoJSON topology or a GeoJSON FeatureCollection (WGS 84). */
  @Prop() geometry?: GeometryInput;
  /** Topology object holding the regions (default: the first). */
  @Prop() geometryObject?: string;
  /** Topology object drawn as neighbouring context land. */
  @Prop() contextObject?: string;
  /** Feature property the region keys match (ISO code by default; postal codes and names match too). */
  @Prop() featureKey = 'code';
  @Prop() colorScale: 'sequential' | 'diverging' = 'sequential';
  @Prop() classes: ClassMode = 'quantize';
  /** Number of classes (3–7). */
  @Prop() classCount = 5;
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** Diverging centre (target, average, zero). */
  @Prop() colorCenter = 0;
  /** `map`: the real shapes; `tiles`: an equal-area tile grid (`tileLayout`). */
  @Prop() shape: 'map' | 'tiles' = 'map';
  /** Tile grid: region code → [column, row]. */
  @Prop() tileLayout?: Record<string, [number, number]>;
  @Prop() projection: ProjectionName = 'auto';
  /** `data`: frame the regions with values; `all`: every boundary. */
  @Prop() fit: 'data' | 'all' = 'data';
  @Prop() labels: 'auto' | 'none' = 'auto';
  @Prop() regionLabel = 'Region';
  @Prop() valueLabel = 'Value';
  @Prop() noDataLabel = 'No data';
  @Prop() zoomable = true;
  @Prop() chartHeight = 360;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  @State() active: number | null = null;
  @State() view: MapView = IDENTITY_VIEW;
  @State() rotation: [number, number] | null = null;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private sizer = new WidthObserver((w) => {
    if (w > 0 && w !== this.width) this.width = w;
  });
  private isGlobe = false;
  private autoRotate: [number, number] = [0, 0];
  private zoom = new MapZoom((v) => (this.view = v), { maxZoom: 10, pan: () => !this.isGlobe });
  private drag = new GlobeDrag(
    () => this.rotation ?? this.autoRotate,
    (r) => (this.rotation = r),
    () => this.ui.focusOpen
  );
  private geoCache: { key: unknown[]; features: Feature[]; context: Feature[]; borders: { inner: MultiLineString | null; outer: MultiLineString | null } } | null = null;

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  private geo() {
    const key = [this.geometry, this.geometryObject, this.contextObject];
    const c = this.geoCache;
    if (c && c.key.every((v, i) => v === key[i])) return c;
    const next = {
      key,
      features: toFeatures(this.geometry, this.geometryObject),
      context: this.contextObject ? toFeatures(this.geometry, this.contextObject) : [],
      borders: borders(this.geometry, this.geometryObject),
    };
    this.geoCache = next;
    return next;
  }

  /** Every region, resolved to its feature when the boundaries know it; largest value first. */
  private shaded(): { list: Shaded[]; unmatched: RegionValue[] } {
    const features = this.geo().features;
    const match = matchRegions(features, this.regions, this.featureKey);
    const list: Shaded[] = [...match.byFeature.entries()].map(([fi, r]) => {
      const props = (features[fi]?.properties ?? {}) as Record<string, unknown>;
      return { r, fi, name: r.label ?? String(props.name ?? r.key), code: featureKey(features[fi] as Feature, 'code') || normKey(r.key) };
    });
    // Without boundaries (tiles only) the keys are the codes themselves
    const unmatched = features.length ? match.unmatched : [];
    if (!features.length) list.push(...this.regions.map((r) => ({ r, fi: null, name: r.label ?? r.key, code: normKey(r.key) })));
    list.sort((a, b) => (b.r.value ?? -Infinity) - (a.r.value ?? -Infinity));
    return { list, unmatched };
  }

  private colour(values: readonly (number | null)[]): { fill: (v: number | null) => string; text: (v: number | null) => string; legend: VNode } {
    const fmt = formatter(this.format);
    const range = extent(values) ?? [0, 1];
    if (this.colorScale === 'diverging') {
      const maxDistance = Math.max(Math.abs(range[0] - this.colorCenter), Math.abs(range[1] - this.colorCenter));
      const step = (v: number | null) => divergingStep(v, { center: this.colorCenter, maxDistance, goodWhen: this.goodWhen });
      const items: ClassSwatch[] = [
        { label: this.goodWhen === 'higher' ? `Below ${fmt(this.colorCenter)}` : `Above ${fmt(this.colorCenter)}`, fill: 'var(--pbi-div-2)' },
        { label: `Around ${fmt(this.colorCenter)}`, fill: 'var(--pbi-div-4)' },
        { label: this.goodWhen === 'higher' ? `Above ${fmt(this.colorCenter)}` : `Below ${fmt(this.colorCenter)}`, fill: 'var(--pbi-div-6)' },
      ];
      return {
        fill: (v) => (step(v) ? rampColour(step(v), 'diverging').fill : ''),
        text: (v) => (step(v) ? rampColour(step(v), 'diverging').text : 'var(--pbi-text)'),
        legend: <ClassLegend items={items} label={this.valueLabel} />,
      };
    }
    const breaks = classBreaks(values, this.classes, this.classCount);
    if (!breaks.length) {
      const step = (v: number | null) => mapStep(v, range);
      return {
        fill: (v) => (step(v) ? rampColour(step(v)).fill : ''),
        text: (v) => (step(v) ? rampColour(step(v)).text : 'var(--pbi-text)'),
        legend: <RampLegend low={fmt(range[0])} high={fmt(range[1])} steps={[2, 3, 4, 5, 6, 7]} label={this.valueLabel} />,
      };
    }
    const steps = mapSteps(breaks.length + 1);
    const stepOf = (v: number | null) => {
      const k = classIndex(v, breaks);
      return k === null ? 0 : (steps[k] ?? 7);
    };
    const items: ClassSwatch[] = steps.map((s, k) => ({
      fill: rampColour(s).fill,
      label: k === 0 ? `≤ ${fmt(breaks[0] as number)}` : k === breaks.length ? `> ${fmt(breaks[k - 1] as number)}` : `${fmt(breaks[k - 1] as number)}–${fmt(breaks[k] as number)}`,
    }));
    return {
      fill: (v) => (stepOf(v) ? rampColour(stepOf(v)).fill : ''),
      text: (v) => (stepOf(v) ? rampColour(stepOf(v)).text : 'var(--pbi-text)'),
      legend: <ClassLegend items={items} label={this.valueLabel} />,
    };
  }

  private model = (): TableModel => {
    const { list, unmatched } = this.shaded();
    return {
      columns: [
        { key: 'region', label: this.regionLabel },
        { key: 'key', label: 'Key' },
        { key: 'value', label: this.valueLabel, kind: 'number', format: this.format },
        { key: 'rank', label: 'Rank', kind: 'number' },
      ],
      rows: [
        ...list.map((s, i) => ({ [ROW_KEY]: s.r.raw ?? s.r.key, region: s.name, key: s.r.key, value: s.r.value, rank: s.r.value === null ? null : i + 1 })),
        ...unmatched.map((r) => ({ [ROW_KEY]: r.raw ?? r.key, region: r.label ?? r.key, key: r.key, value: r.value, rank: null })),
      ],
    };
  };

  private item = (s: Shaded) => ({ id: s.r.key, label: s.name, raw: s.r.raw ?? s.r.key });

  private onKeyDown(e: KeyboardEvent, list: Shaded[], centroids: Map<number, [number, number]>, globe: boolean): void {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.zoom.zoomBy(1.6);
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.zoom.zoomBy(1 / 1.6);
      return;
    }
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    const at = this.active !== null ? list[this.active] : undefined;
    if ((e.key === 'Enter' || e.key === ' ') && at) {
      e.preventDefault();
      if (isInteractive(this)) emitClick(this, this.item(at));
      return;
    }
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, list.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
    const s = list[next];
    const c = s && s.fi !== null ? centroids.get(s.fi) : undefined;
    if (globe && c) this.rotation = [-c[0], -c[1]];
  }

  private tooltip(s: Shaded, rank: number, total: number, fmt: (v: number) => string): TooltipRow[] {
    return [
      { label: this.valueLabel, value: s.r.value === null ? '—' : fmt(s.r.value) },
      ...(s.r.value === null ? [] : [{ label: 'Rank', value: `${rank} of ${total}` }]),
      ...tooltipRows(s.r.tooltips),
    ];
  }

  private renderChart = () => {
    const width = Math.max(240, this.width);
    const height = this.chartHeight;
    const { list, unmatched } = this.shaded();
    const scale = this.colour(list.map((s) => s.r.value));
    const fmt = formatter(this.format);
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const isSelected = (s: Shaded) => hasSelection && sameValue(s.r.raw ?? s.r.key, this.selectedValue);
    const active = this.active !== null && this.active < list.length ? this.active : null;
    const ranked = list.filter((s) => s.r.value !== null).length;
    const p = this.testIdPrefix;
    const hatch = `cp-${this.visualId ?? 'map'}-nodata`;
    const note =
      unmatched.length > 0 ? (
        <p class="u-note cp-note">{`${unmatched.length} ${unmatched.length === 1 ? 'region is' : 'regions are'} not on this map: ${unmatched
          .slice(0, 4)
          .map((r) => r.label ?? r.key)
          .join(', ')}${unmatched.length > 4 ? '…' : ''}`}</p>
      ) : null;
    const handlers = (s: Shaded, k: number) => ({
      'data-dimmed': String((hasSelection && !isSelected(s)) || (active !== null && active !== k)),
      'data-interactive': String(interactive),
      'data-testid': p ? `${p}-region-${s.r.key}` : undefined,
      onMouseEnter: () => (this.active = k),
      onClick: () => interactive && emitClick(this, this.item(s)),
    });

    if (this.shape === 'tiles' && this.tileLayout) {
      const tiles = tilePositions(this.tileLayout, list.map((s) => s.code));
      const cols = Math.max(1, ...tiles.map((t) => t.col + 1));
      const rows = Math.max(1, ...tiles.map((t) => t.row + 1));
      const size = Math.floor(Math.min((width - 8) / cols, (height - 8) / rows));
      const ox = (width - size * cols) / 2;
      const oy = (height - size * rows) / 2;
      const byCode = new Map(list.map((s, k) => [s.code, { s, k }]));
      const tipFor = active !== null ? list[active] : undefined;
      const tipTile = tipFor ? tiles.find((t) => t.key === tipFor.code) : undefined;
      return (
        <div class="map cp" ref={this.sizer.observe}>
          <div class="map-frame" style={{ height: `${height}px` }}>
            <svg
              width={width}
              height={height}
              class="map-svg u-chart-svg"
              role="img"
              aria-label={`${chartLabel(this)}: ${list.length} regions, tile map`}
              tabindex={0}
              onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, list, new Map(), false)}
              onMouseLeave={() => (this.active = null)}
              onBlur={() => (this.active = null)}
            >
              <NoDataPattern id={hatch} />
              {tiles.map((t) => {
                const hit = byCode.get(t.key);
                const x = ox + t.col * size;
                const y = oy + t.row * size;
                const v = hit?.s.r.value ?? null;
                const fill = hit ? scale.fill(v) : '';
                const code = t.key.includes('-') ? t.key.split('-')[1] : t.key;
                return (
                  <g key={t.key} {...(hit ? handlers(hit.s, hit.k) : {})} class={{ 'map-mark': true, 'cp-tile': true, 'u-mark-active': Boolean(hit && (isSelected(hit.s) || active === hit.k)) }}>
                    <rect x={x + 1.5} y={y + 1.5} width={size - 3} height={size - 3} rx={4} style={{ fill: fill || `url(#${hatch})` }} />
                    {size >= 22 && (
                      <text x={x + size / 2} y={y + size / 2 + (size >= 38 && hit && v !== null ? -2 : 4)} text-anchor="middle" class="cp-tile-code" style={{ fill: hit ? scale.text(v) : 'var(--pbi-text)' }}>
                        {code}
                      </text>
                    )}
                    {size >= 38 && hit && v !== null && (
                      <text x={x + size / 2} y={y + size / 2 + 11} text-anchor="middle" class="cp-tile-value" style={{ fill: scale.text(v) }}>
                        {fmt(v)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {tipFor && tipTile && (
              <ChartTooltip x={Math.min(Math.max(ox + (tipTile.col + 0.5) * size, 90), width - 90)} y={Math.max(8, oy + tipTile.row * size - 6)} title={tipFor.name} rows={this.tooltip(tipFor, (active ?? 0) + 1, ranked, fmt)} />
            )}
          </div>
          <div class="map-legends">
            {scale.legend}
            <ClassLegend items={[]} noData={this.noDataLabel} hatchId={hatch} />
          </div>
          {note}
        </div>
      );
    }

    const geo = this.geo();
    const withData = list.filter((s) => s.fi !== null).map((s) => geo.features[s.fi as number] as Feature);
    const fitFeatures = this.fit === 'data' && withData.length ? withData : geo.features;
    // A globe opens on the region with the largest value (list is in value order)
    const lead = list.find((s) => s.fi !== null);
    const opening = this.rotation ?? (lead ? globeRotation(...centroidOf(geo.features[lead.fi as number] as Feature)) : undefined);
    const fitted = fitProjection(this.projection, { type: 'FeatureCollection', features: fitFeatures } as never, { width, height, pad: 16, rotate: opening });
    const globe = fitted.kind === 'globe';
    this.isGlobe = globe;
    if (globe && !this.rotation) {
      const r = fitted.projection.rotate();
      this.autoRotate = [r[0], r[1]];
    }
    const projection = applyView(fitted.projection, this.view, globe, [width, height]);
    // One decimal is sub-pixel: path strings stay small on detailed boundaries
    const path = geoPath(projection).digits(1);
    // Feature index → its region and the region's position in value order (the keyboard order)
    const byFeature = new Map<number, { s: Shaded; k: number }>();
    list.forEach((s, k) => s.fi !== null && byFeature.set(s.fi, { s, k }));
    const centroids = new Map<number, [number, number]>();
    const labels: VNode[] = [];
    const shapes = geo.features.map((f, fi) => {
      const d = path(f) ?? '';
      const hit = byFeature.get(fi);
      if (!hit) return <path key={`f${fi}`} d={d} class="cp-region cp-region--nodata" style={{ fill: `url(#${hatch})` }} />;
      const v = hit.s.r.value;
      const c = path.centroid(f);
      if (this.labels === 'auto' && d && Number.isFinite(c[0]) && path.area(f) > LABEL_AREA) {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        labels.push(
          <text key={`t${fi}`} x={c[0]} y={c[1] + 4} text-anchor="middle" class="cp-label" style={{ fill: scale.text(v) }}>
            {String(props.postal ?? hit.s.code.split('-').pop() ?? hit.s.name)}
          </text>
        );
      }
      return (
        <path
          key={`f${fi}`}
          d={d}
          {...handlers(hit.s, hit.k)}
          class={{ 'map-mark': true, 'cp-region': true, 'u-mark-active': isSelected(hit.s) || active === hit.k }}
          style={{ fill: scale.fill(v) || `url(#${hatch})` }}
        />
      );
    });
    // Geographic centroids, for turning the globe to a region
    if (globe) list.forEach((s) => s.fi !== null && centroids.set(s.fi, centroidOf(geo.features[s.fi] as Feature)));
    const activeShaded = active !== null ? list[active] : undefined;
    const activeFeature = activeShaded && activeShaded.fi !== null ? (geo.features[activeShaded.fi] as Feature) : undefined;
    const tipAt = activeFeature ? path.centroid(activeFeature) : null;
    const selectedFeatures = list.filter((s) => s.fi !== null && isSelected(s)).map((s) => geo.features[s.fi as number] as Feature);
    const zoomed = this.view.k > 1 || this.rotation !== null;
    return (
      <div class="map cp" ref={this.sizer.observe}>
        <div class="map-frame" style={{ height: `${height}px` }}>
          <svg
            ref={this.zoom.attach}
            width={width}
            height={height}
            class="map-svg u-chart-svg"
            role="img"
            aria-label={`${chartLabel(this)}: ${list.length} regions`}
            tabindex={0}
            data-globe={String(globe)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, list, centroids, globe)}
            onMouseLeave={() => (this.active = null)}
            onBlur={() => (this.active = null)}
            onPointerDown={globe ? this.drag.down : undefined}
            onPointerMove={globe ? this.drag.move : undefined}
            onPointerUp={globe ? this.drag.up : undefined}
            onPointerCancel={globe ? this.drag.up : undefined}
          >
            <NoDataPattern id={hatch} />
            <MapBase
              path={path}
              globe={globe}
              graticule={globe || fitted.kind === 'equal-earth'}
              width={width}
              height={height}
              context={geo.context}
              land={[]}
              borders={geo.borders}
              idPrefix={`cp-${this.visualId ?? 'map'}`}
              withBorders={false}
            />
            <g class="cp-regions">{shapes}</g>
            <MapBorders path={path} borders={geo.borders} />
            {[...selectedFeatures, ...(activeFeature ? [activeFeature] : [])].map((f, i) => (
              <path key={`o${i}`} d={path(f) ?? ''} class="cp-outline" />
            ))}
            {labels}
          </svg>
          {this.zoomable && (
            <MapControls
              label={chartLabel(this)}
              zoomed={zoomed}
              onZoom={(f) => this.zoom.zoomBy(f)}
              onReset={() => {
                this.zoom.reset();
                this.rotation = null;
              }}
            />
          )}
          {activeShaded && tipAt && Number.isFinite(tipAt[0]) && (
            <ChartTooltip x={Math.min(Math.max(tipAt[0], 90), width - 90)} y={Math.max(8, tipAt[1] - 14)} title={activeShaded.name} rows={this.tooltip(activeShaded, (active ?? 0) + 1, ranked, fmt)} />
          )}
        </div>
        <div class="map-legends">
          {scale.legend}
          <ClassLegend items={[]} noData={this.noDataLabel} hatchId={hatch} />
          {globe && <p class="map-hint">Drag to turn the globe; arrow keys move between regions.</p>}
        </div>
        {note}
      </div>
    );
  };

  private renderTable = () => {
    const m = this.model();
    return (
      <udp-pbi-data-table
        frame="none"
        visualId={this.visualId}
        label={`${chartLabel(this)} (table)`}
        columns={m.columns}
        rows={m.rows}
        rowKey={ROW_KEY}
        selectedValue={this.selectedValue}
        crossFilterField={this.crossFilterField}
        interactive={isInteractive(this)}
      />
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.regions.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}

/** Geographic centre of a feature (for turning a globe towards it). */
function centroidOf(f: Feature): [number, number] {
  const coords: number[][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') coords.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk((f.geometry as { coordinates?: unknown } | null)?.coordinates);
  if (!coords.length) return [0, 0];
  const lon = coords.reduce((t, c) => t + (c[0] ?? 0), 0) / coords.length;
  const lat = coords.reduce((t, c) => t + (c[1] ?? 0), 0) / coords.length;
  return [lon, lat];
}
