import { Component, Element, Event, h, Host, Prop, State, type EventEmitter, type VNode } from '@stencil/core';
import { geoPath } from 'd3-geo';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import type { Feature, MultiLineString } from 'geojson';
import { ChartTooltip, Legend, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import {
  applyView,
  GlobeDrag,
  IDENTITY_VIEW,
  MapBase,
  MapControls,
  MapZoom,
  mercatorTiles,
  RampLegend,
  SizeLegend,
  TileLayer,
  type MapTiles,
  type MapView,
} from '../../../functional/map-kit';
import { chartLabel, clickValue, emitClick, isInteractive } from '../../../utils/data';
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
  densityBands,
  fitProjection,
  globeRotation,
  hexagonPath,
  hexbins,
  landOf,
  mapStep,
  onFrontHemisphere,
  placeLabels,
  pointsTarget,
  sizeLegendValues,
  spikePath,
  toFeatures,
  type GeometryInput,
  type GeoPoint,
  type HexBin,
  type ProjectionName,
} from '../../../utils/layout/geo';
import { extent } from '../../../utils/layout/scales';
import { rampColour, seriesColour } from '../../../utils/palette';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

export type PointMark = 'dot' | 'bubble' | 'spike' | 'hexbin' | 'heat';

const HEX_RADIUS = 14;
const MAX_BUBBLE = 22;
const MAX_SPIKE = 90;
const LABEL_TOP = 3;

interface Placed {
  i: number;
  p: GeoPoint;
  x: number;
  y: number;
  visible: boolean;
}

const finitePoint = (p: GeoPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/**
 * Point map (FT "spatial"): locations at their exact coordinates (WGS 84 latitude / longitude).
 * `dot` places them (colour by group), `bubble` and `spike` size them by value (area ∝ value; a
 * spike's height ∝ value, the 2.5D variant), `hexbin` and `heat` show density where points crowd.
 * `projection="globe"` draws an orthographic globe you rotate by dragging, or by moving between
 * locations with the arrow keys. Boundaries are context only (`geometry`, from the host); an
 * optional raster basemap comes from the host too (`tiles`, Web Mercator). Zoom with the buttons,
 * Ctrl + wheel or a pinch; the page keeps its scroll. A click (Enter / Space) reports the location.
 */
@Component({
  tag: 'udp-pbi-point-map',
  styleUrls: [
    '../../../styles/tokens-bridge.css',
    '../../../styles/motion.css',
    '../../../styles/shadow.css',
    '../../../styles/surfaces.css',
    '../../../styles/charts.css',
    '../../../styles/maps.css',
    'udp-pbi-point-map.css',
  ],
  shadow: true,
})
export class UdpPbiPointMap {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title. */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the map (default: heading). */
  @Prop() label?: string;
  @Prop() info?: string;
  @Prop() calc?: string;
  /** Format of the values. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected location (its raw value or id). */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column a click filters (reported in `dataPointClick`). */
  @Prop() crossFilterField?: string;
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() tableToggle = true;
  @Prop() theme?: ThemeName;
  /** `card` (default): the template card; `none`: the map alone, for a host card. */
  @Prop() frame: VisualFrameMode = 'card';
  /** data-testid prefix: `${p}-point-${id}`. */
  @Prop() testIdPrefix?: string;
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** The located points. */
  @Prop() points: GeoPoint[] = [];
  @Prop() mark: PointMark = 'dot';
  /** `auto` picks by extent (Mercator → conic → Equal Earth); `globe` is an orthographic sphere. */
  @Prop() projection: ProjectionName = 'auto';
  /** Context boundaries: a TopoJSON topology or a GeoJSON FeatureCollection (WGS 84). */
  @Prop() geometry?: GeometryInput;
  /** Topology object drawn as land (default: the first). */
  @Prop() geometryObject?: string;
  /** Topology object drawn as neighbouring context land. */
  @Prop() contextObject?: string;
  /** Raster basemap from the host (Web Mercator; forces a Mercator projection). */
  @Prop() tiles?: MapTiles;
  @Prop() categoryLabel = 'Location';
  @Prop() valueLabel = 'Value';
  @Prop() groupLabel = 'Group';
  /** Zoom buttons, Ctrl + wheel and pinch. */
  @Prop() zoomable = true;
  @Prop() chartHeight = 360;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  @State() active: number | null = null;
  @State() activeBin: HexBin | null = null;
  @State() view: MapView = IDENTITY_VIEW;
  /** Globe rotation [λ, φ] once the user turns it; null = centred on the data. */
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
  private zoom = new MapZoom((v) => (this.view = v), { maxZoom: 12, pan: () => !this.isGlobe });
  private drag = new GlobeDrag(
    () => this.rotation ?? this.autoRotate,
    (r) => (this.rotation = r),
    () => this.ui.focusOpen
  );
  private geoCache: { key: unknown; land: Feature[]; regions: Feature[]; context: Feature[]; borders: { inner: MultiLineString | null; outer: MultiLineString | null } } | null = null;

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  private geo() {
    const key = [this.geometry, this.geometryObject, this.contextObject];
    const c = this.geoCache;
    if (c && (c.key as unknown[]).every((v, i) => v === key[i])) return c;
    const next = {
      key,
      // One merged land shape plus the borders: every boundary line drawn once
      land: landOf(this.geometry, this.geometryObject),
      regions: toFeatures(this.geometry, this.geometryObject),
      context: this.contextObject ? toFeatures(this.geometry, this.contextObject) : [],
      borders: borders(this.geometry, this.geometryObject),
    };
    this.geoCache = next;
    return next;
  }

  /** Points in drawing / keyboard order: largest value first (small marks stay on top). */
  private get ordered(): GeoPoint[] {
    return this.points.filter(finitePoint).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  }

  private get groups(): string[] {
    return [...new Set(this.points.map((p) => p.group).filter((g): g is string => Boolean(g)))];
  }

  private model = (): TableModel => {
    const groups = this.groups;
    const values = this.points.some((p) => p.value !== null && p.value !== undefined);
    return {
      columns: [
        { key: 'location', label: this.categoryLabel },
        ...(groups.length ? [{ key: 'group', label: this.groupLabel }] : []),
        ...(values ? [{ key: 'value', label: this.valueLabel, kind: 'number' as const, format: this.format }] : []),
        { key: 'lat', label: 'Latitude', kind: 'number', format: { style: 'decimal', decimals: 5 } },
        { key: 'lon', label: 'Longitude', kind: 'number', format: { style: 'decimal', decimals: 5 } },
      ],
      rows: this.ordered.map((p) => ({
        [ROW_KEY]: clickValue(p),
        location: p.label,
        ...(groups.length ? { group: p.group ?? null } : {}),
        ...(values ? { value: p.value ?? null } : {}),
        lat: p.lat,
        lon: p.lon,
      })),
    };
  };

  private onKeyDown(e: KeyboardEvent, placed: Placed[], globe: boolean): void {
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
    const at = this.active !== null ? placed[this.active] : undefined;
    if ((e.key === 'Enter' || e.key === ' ') && at) {
      e.preventDefault();
      if (isInteractive(this)) emitClick(this, at.p);
      return;
    }
    if (this.mark === 'hexbin' || this.mark === 'heat') return;
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, placed.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
    // Bring the location into view: the globe turns to it (keyboard moves are never animated)
    const p = placed[next]?.p;
    if (p && globe) this.rotation = [-p.lon, -p.lat];
  }

  private tooltip(p: GeoPoint, fmt: (v: number) => string): TooltipRow[] {
    return [
      ...(p.value !== null && p.value !== undefined ? [{ label: this.valueLabel, value: fmt(p.value) }] : []),
      ...(p.group ? [{ label: this.groupLabel, value: p.group }] : []),
      { label: 'Coordinates', value: `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}` },
      ...tooltipRows(p.tooltips),
    ];
  }

  private renderChart = () => {
    const width = Math.max(240, this.width);
    const height = this.chartHeight;
    const pts = this.ordered;
    const geo = this.geo();
    const fitTarget = pointsTarget(pts) ?? (geo.regions.length ? { type: 'FeatureCollection' as const, features: geo.regions } : { type: 'Sphere' as const });
    const tiles = this.tiles && this.projection !== 'globe' ? this.tiles : undefined;
    // A globe opens on the largest value (pts is in value order); it then turns as the user drags
    const top = pts[0];
    const opening = this.rotation ?? (top ? globeRotation(top.lon, top.lat) : undefined);
    // Room above the northernmost spike and its label
    const padTop = this.mark === 'spike' && this.projection !== 'globe' ? MAX_SPIKE + 18 : 28;
    const fitted = fitProjection(tiles ? 'mercator' : this.projection, fitTarget as never, { width, height, pad: 28, padTop, rotate: opening });
    const globe = fitted.kind === 'globe';
    this.isGlobe = globe;
    if (globe && !this.rotation) {
      const r = fitted.projection.rotate();
      this.autoRotate = [r[0], r[1]];
    }
    const projection = applyView(fitted.projection, this.view, globe, [width, height]);
    // One decimal is sub-pixel: path strings stay small on detailed boundaries
    const path = geoPath(projection).digits(1);
    const rotate = projection.rotate();
    const radius = projection.scale();
    const fmt = formatter(this.format);
    const mark: PointMark = globe && (this.mark === 'hexbin' || this.mark === 'heat') ? 'dot' : this.mark;
    const interactive = isInteractive(this);
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const p = this.testIdPrefix;

    const placed: Placed[] = pts.map((pt, i) => {
      const xy = projection([pt.lon, pt.lat]) ?? [NaN, NaN];
      const visible = globe ? onFrontHemisphere([rotate[0], rotate[1]], pt.lon, pt.lat) : xy[0] >= -30 && xy[0] <= width + 30 && xy[1] >= -30 && xy[1] <= height + 30;
      return { i, p: pt, x: xy[0], y: xy[1], visible: visible && Number.isFinite(xy[0]) };
    });
    const groups = this.groups;
    const colourOf = (pt: GeoPoint) => (pt.group ? seriesColour(groups.indexOf(pt.group), groups.length).fill : 'var(--pbi-primary)');
    const maxValue = Math.max(0, ...pts.map((pt) => Math.abs(pt.value ?? 0)));
    const bubble = scaleSqrt().domain([0, maxValue || 1]).range([0, MAX_BUBBLE]);
    // On a globe the spikes scale with the sphere, so they stay readable at any size
    const spike = scaleLinear().domain([0, maxValue || 1]).range([0, globe ? Math.min(MAX_SPIKE, radius * 0.32) : MAX_SPIKE]);
    const sizeOf = (pt: GeoPoint) => (mark === 'bubble' ? Math.max(3, bubble(Math.abs(pt.value ?? 0))) : mark === 'dot' ? 5 : 4);
    const active = this.active !== null && this.active < placed.length ? (placed[this.active] as Placed) : null;
    const labelled = new Set(placed.filter((pl) => pl.p.value !== null && pl.p.value !== undefined).slice(0, LABEL_TOP).map((pl) => pl.i));
    const isSelected = (pt: GeoPoint) => hasSelection && sameValue(clickValue(pt), this.selectedValue);

    const marks: VNode[] = [];
    const legends: VNode[] = [];
    if (mark === 'hexbin') {
      const screen = placed.filter((pl) => pl.visible).map((pl) => ({ x: pl.x, y: pl.y, weight: pl.p.value ?? 1 }));
      const bins = hexbins(screen, HEX_RADIUS, width, height);
      const range = extent(bins.map((b) => b.total)) ?? [0, 1];
      const hex = hexagonPath(HEX_RADIUS - 0.5);
      bins.forEach((b, k) => {
        const step = mapStep(b.total, range);
        marks.push(
          <path
            key={`h${k}`}
            d={hex}
            transform={`translate(${b.x.toFixed(1)},${b.y.toFixed(1)})`}
            class="map-mark pm-hex"
            style={{ fill: rampColour(step).fill }}
            data-interactive="true"
            onMouseEnter={() => (this.activeBin = b)}
            onClick={() => this.zoom.zoomTo((b.x - this.view.x) / this.view.k, (b.y - this.view.y) / this.view.k, Math.min(12, this.view.k * 2.5), width, height)}
          />
        );
      });
      legends.push(<RampLegend low="Fewer" high="More" steps={[2, 3, 4, 5, 6, 7]} label={this.valueLabel} />);
    } else if (mark === 'heat') {
      const screen = placed.filter((pl) => pl.visible).map((pl) => ({ x: pl.x, y: pl.y, weight: pl.p.value ?? 1 }));
      const bands = densityBands(screen, width, height, 22, 7);
      const identity = geoPath();
      bands.forEach((band, k) => {
        const step = Math.min(7, 2 + Math.round((k * 5) / Math.max(1, bands.length - 1)));
        marks.push(<path key={`d${k}`} d={identity(band.geometry) ?? ''} class="pm-heat" style={{ fill: rampColour(step).fill }} />);
      });
      legends.push(<RampLegend low="Sparse" high="Dense" steps={[2, 3, 4, 5, 6, 7]} label={this.valueLabel} />);
    } else {
      const drawOrder = mark === 'spike' ? [...placed].sort((a, b) => a.y - b.y) : placed;
      for (const pl of drawOrder) {
        if (!pl.visible) continue;
        const pt = pl.p;
        const dimmed = (hasSelection && !isSelected(pt)) || (active !== null && active.i !== pl.i);
        const common = {
          key: pt.id,
          'data-dimmed': String(dimmed),
          'data-interactive': String(interactive),
          'data-testid': p ? `${p}-point-${pt.id}` : undefined,
          onMouseEnter: () => (this.active = pl.i),
          onClick: () => interactive && emitClick(this, pt),
        };
        if (mark === 'spike') {
          // Spikes stand upright on screen, on a globe too: their lengths stay comparable anywhere
          const d = spikePath(pl.x, pl.y, spike(Math.abs(pt.value ?? 0)), 7);
          marks.push(<path {...common} d={d} class={{ 'map-mark': true, 'pm-spike': true, 'u-mark-active': isSelected(pt) || active?.i === pl.i }} />);
        } else {
          marks.push(
            <circle
              {...common}
              cx={pl.x}
              cy={pl.y}
              r={sizeOf(pt)}
              class={{ 'map-mark': true, 'pm-dot': mark === 'dot', 'pm-bubble': mark === 'bubble', 'u-mark-active': isSelected(pt) || active?.i === pl.i }}
              style={{ fill: colourOf(pt) }}
            />
          );
        }
      }
      // Labels: the active and selected locations first, then the largest values; never overlapping
      const wanted = placed
        .filter((pl) => pl.visible && (labelled.has(pl.i) || active?.i === pl.i || isSelected(pl.p)))
        .sort((a, b) => Number(active?.i === b.i || isSelected(b.p)) - Number(active?.i === a.i || isSelected(a.p)))
        .map((pl) => {
          const r = mark === 'spike' ? 0 : sizeOf(pl.p);
          const tipY = mark === 'spike' ? pl.y - spike(Math.abs(pl.p.value ?? 0)) - 6 : pl.y + 4;
          const x = mark === 'spike' ? pl.x - (pl.p.label.length * 6.2) / 2 : pl.x + r + 4;
          return { pl, x, y: tipY, text: pl.p.label };
        });
      for (const l of placeLabels(wanted)) {
        marks.push(
          <text key={`t${l.pl.p.id}`} x={l.x} y={l.y} class="map-label">
            {l.text}
          </text>
        );
      }
      if (groups.length && mark !== 'spike') legends.push(<Legend label={this.groupLabel} items={groups.map((g, k) => ({ label: g, fill: seriesColour(k, groups.length).fill }))} />);
      if ((mark === 'bubble' || mark === 'spike') && maxValue > 0) {
        const values = sizeLegendValues(maxValue).map((v) => ({ value: v, size: mark === 'bubble' ? bubble(v) : spike(v), label: fmt(v) }));
        legends.push(<SizeLegend values={values} mark={mark} title={this.valueLabel} />);
      }
    }

    const tileSet = tiles ? mercatorTiles(projection, width, height, tiles) : [];
    const zoomed = this.view.k > 1 || this.rotation !== null;
    const tip = mark === 'hexbin' ? this.activeBin : null;
    const idPrefix = `pm-${this.visualId ?? 'map'}`;
    return (
      <div class="map pm" ref={this.sizer.observe}>
        <div class="map-frame" style={{ height: `${height}px` }}>
          <svg
            ref={this.zoom.attach}
            width={width}
            height={height}
            class="map-svg u-chart-svg"
            role="img"
            aria-label={`${chartLabel(this)}: ${pts.length} ${pts.length === 1 ? 'location' : 'locations'}`}
            tabindex={0}
            data-globe={String(globe)}
            onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, placed, globe)}
            onMouseLeave={() => {
              this.active = null;
              this.activeBin = null;
            }}
            onBlur={() => (this.active = null)}
            onPointerDown={globe ? this.drag.down : undefined}
            onPointerMove={globe ? this.drag.move : undefined}
            onPointerUp={globe ? this.drag.up : undefined}
            onPointerCancel={globe ? this.drag.up : undefined}
          >
            {tileSet.length ? (
              <TileLayer tiles={tileSet} />
            ) : (
              <MapBase
                path={path}
                globe={globe}
                graticule={globe || fitted.kind === 'equal-earth'}
                width={width}
                height={height}
                context={geo.context}
                land={geo.land}
                borders={geo.borders}
                idPrefix={idPrefix}
              />
            )}
            <g class="pm-marks">{marks}</g>
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
          {tiles && <span class="map-attribution">{tiles.attribution}</span>}
          {active && active.visible && mark !== 'hexbin' && mark !== 'heat' && (
            <ChartTooltip x={Math.min(Math.max(active.x, 90), width - 90)} y={Math.max(8, active.y - (mark === 'spike' ? spike(Math.abs(active.p.value ?? 0)) : sizeOf(active.p)) - 12)} title={active.p.label} rows={this.tooltip(active.p, fmt)} />
          )}
          {tip && (
            <ChartTooltip
              x={Math.min(Math.max(tip.x, 90), width - 90)}
              y={Math.max(8, tip.y - HEX_RADIUS - 8)}
              title={`${tip.count} ${tip.count === 1 ? 'location' : 'locations'}`}
              rows={[{ label: this.valueLabel, value: fmt(tip.total) }]}
            />
          )}
        </div>
        {(legends.length > 0 || globe) && (
          <div class="map-legends">
            {legends}
            {globe && <p class="map-hint">Drag to turn the globe; arrow keys move between locations.</p>}
          </div>
        )}
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
          hasData={this.points.some(finitePoint)}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
