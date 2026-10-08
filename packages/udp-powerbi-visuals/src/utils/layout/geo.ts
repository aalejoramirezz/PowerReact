import { quantileSorted } from 'd3-array';
import { contourDensity } from 'd3-contour';
import { geoBounds, geoCentroid, geoConicConformal, geoDistance, geoEqualEarth, geoMercator, geoOrthographic, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { hexbin } from 'd3-hexbin';
import type { Feature, FeatureCollection, Geometry, MultiLineString, MultiPoint } from 'geojson';
import { feature, merge, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { DataPointValue, TooltipItem } from '../events';
import { RAMP_STEPS } from '../palette';

/**
 * Geography for the map elements: pure functions over GeoJSON / TopoJSON and d3-geo, no DOM.
 * Coordinates are WGS 84 longitude / latitude in degrees.
 */

/** A located data point (coordinates exactly as the model stores them). */
export interface GeoPoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  value?: number | null;
  group?: string;
  raw?: DataPointValue;
  tooltips?: TooltipItem[];
}

/** A value for one region, matched to a boundary feature by key (ISO code, postal code or name). */
export interface RegionValue {
  key: string;
  label?: string;
  value: number | null;
  raw?: DataPointValue;
  tooltips?: TooltipItem[];
}

export type ProjectionName = 'auto' | 'mercator' | 'conic' | 'equal-earth' | 'globe';
export type Bounds = [[number, number], [number, number]];

/** Boundary input: a TopoJSON topology (with the object to read) or a GeoJSON FeatureCollection. */
export type GeometryInput = Topology | FeatureCollection | null | undefined;

const isTopology = (g: unknown): g is Topology => typeof g === 'object' && g !== null && (g as { type?: string }).type === 'Topology';

/** The features of one object of a topology (default: its first), or of a FeatureCollection. */
export function toFeatures(geometry: GeometryInput, object?: string): Feature[] {
  if (!geometry) return [];
  if (isTopology(geometry)) {
    const name = object && geometry.objects[object] ? object : Object.keys(geometry.objects)[0];
    const obj = name ? (geometry.objects[name] as GeometryCollection | undefined) : undefined;
    if (!obj) return [];
    const fc = feature(geometry, obj) as FeatureCollection | Feature;
    return 'features' in fc ? fc.features : [fc];
  }
  return geometry.type === 'FeatureCollection' ? geometry.features : [];
}

/**
 * Land of an object as one merged shape (each coastline once, no inner edges): the cheap backdrop
 * of a point map. GeoJSON input is returned as its features.
 */
export function landOf(geometry: GeometryInput, object?: string): Feature[] {
  if (!isTopology(geometry)) return toFeatures(geometry, object);
  const name = object && geometry.objects[object] ? object : Object.keys(geometry.objects)[0];
  const obj = name ? (geometry.objects[name] as GeometryCollection | undefined) : undefined;
  if (!obj || !('geometries' in obj)) return toFeatures(geometry, object);
  return [{ type: 'Feature', properties: {}, geometry: merge(geometry, obj.geometries as never) }];
}

/**
 * Shared borders of a topology object, drawn once (no double strokes): `inner` between features of
 * one country, `outer` between countries and along coasts. Null for GeoJSON input (no topology).
 */
export function borders(geometry: GeometryInput, object?: string): { inner: MultiLineString | null; outer: MultiLineString | null } {
  if (!isTopology(geometry)) return { inner: null, outer: null };
  const name = object && geometry.objects[object] ? object : Object.keys(geometry.objects)[0];
  const obj = name ? (geometry.objects[name] as GeometryCollection | undefined) : undefined;
  if (!obj) return { inner: null, outer: null };
  const country = (g: GeometryObject) => (g.properties as { country?: string } | undefined)?.country;
  return {
    inner: mesh(geometry, obj, (a, b) => a !== b && country(a) === country(b)),
    outer: mesh(geometry, obj, (a, b) => a === b || country(a) !== country(b)),
  };
}

/** Longitude span of geographic bounds, across the antimeridian when west > east. */
export function lonSpan([[west], [east]]: Bounds): number {
  return east >= west ? east - west : east + 360 - west;
}

/** Middle longitude of bounds (antimeridian aware), in [-180, 180). */
export function lonCenter(b: Bounds): number {
  const c = b[0][0] + lonSpan(b) / 2;
  return ((((c + 180) % 360) + 360) % 360) - 180;
}

/** The flat projection that suits an extent: Mercator for a city or region, conic for a continent, Equal Earth for the world. */
export function pickProjection(b: Bounds): Exclude<ProjectionName, 'auto' | 'globe'> {
  const lon = lonSpan(b);
  const lat = b[1][1] - b[0][1];
  if (lon <= 15 && lat <= 15) return 'mercator';
  if (lon <= 120 && lat <= 70) return 'conic';
  return 'equal-earth';
}

/** Smallest extent fitted around data (about 20 km), so one point or one street still gets a map. */
const MIN_SPAN = 0.2;

/** What to fit: the points (padded to MIN_SPAN when they nearly coincide). */
export function pointsTarget(points: readonly Pick<GeoPoint, 'lat' | 'lon'>[]): MultiPoint | null {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!valid.length) return null;
  const mp: MultiPoint = { type: 'MultiPoint', coordinates: valid.map((p) => [p.lon, p.lat]) };
  const b = geoBounds(mp) as Bounds;
  if (lonSpan(b) >= MIN_SPAN || b[1][1] - b[0][1] >= MIN_SPAN) return mp;
  const [cx, cy] = [lonCenter(b), (b[0][1] + b[1][1]) / 2];
  const h = MIN_SPAN / 2;
  return { type: 'MultiPoint', coordinates: [[cx - h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx + h, cy - h]] };
}

export interface FitOptions {
  width: number;
  height: number;
  /** Padding around the fitted extent, in pixels. */
  pad?: number;
  /** Extra room at the top (spikes rise above their locations). */
  padTop?: number;
  /** Globe rotation [λ, φ] (degrees); default: centred on the target. */
  rotate?: [number, number];
}

/**
 * A projection fitted to `target` within the box. `auto` picks by extent; `globe` is an
 * orthographic sphere centred on the target (rotation is the element's state).
 */
export function fitProjection(name: ProjectionName, target: GeoPermissibleObjects, { width, height, pad = 12, padTop = pad, rotate }: FitOptions): { projection: GeoProjection; kind: Exclude<ProjectionName, 'auto'> } {
  const box: [[number, number], [number, number]] = [
    [pad, Math.min(padTop, height / 2)],
    [Math.max(pad + 1, width - pad), Math.max(pad + 1, height - pad)],
  ];
  // Nothing to fit yet (e.g. boundaries still loading): the whole sphere, never a NaN projection
  let b = geoBounds(target) as Bounds;
  if (!b.flat().every(Number.isFinite)) {
    target = { type: 'Sphere' };
    b = [[-180, -90], [180, 90]];
  }
  const kind = name === 'auto' ? pickProjection(b) : name;
  if (kind === 'globe') {
    const [cx, cy] = geoCentroid(target).map((v) => (Number.isFinite(v) ? v : 0)) as [number, number];
    const r = rotate ?? [-cx, -cy];
    return { projection: geoOrthographic().rotate(r).clipAngle(90).fitExtent(box, { type: 'Sphere' }), kind };
  }
  if (kind === 'mercator') return { projection: geoMercator().fitExtent(box, target), kind };
  if (kind === 'equal-earth') {
    const world = lonSpan(b) > 300;
    return { projection: geoEqualEarth().fitExtent(box, world ? { type: 'Sphere' } : target), kind };
  }
  const south = b[0][1];
  const north = b[1][1];
  const span = north - south;
  const parallels: [number, number] = [south + span / 6, north - span / 6];
  // A conformal conic needs parallels away from the equator and from each other
  const safe: [number, number] = Math.abs(parallels[0] + parallels[1]) < 2 ? [20, 50] : parallels[0] === parallels[1] ? [parallels[0] - 5, parallels[1] + 5] : parallels;
  return { projection: geoConicConformal().rotate([-lonCenter(b), 0]).parallels(safe).fitExtent(box, target), kind };
}

/* ─────────────────────────── regions ─────────────────────────── */

/** Normalised key: upper case, trimmed, inner spaces collapsed. */
export const normKey = (k: unknown): string => String(k ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** A feature's key: the property named `key`, else its id. */
export function featureKey(f: Feature, key = 'code'): string {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  return normKey(p[key] ?? f.id ?? '');
}

export interface RegionMatch {
  /** Value per feature index. */
  byFeature: Map<number, RegionValue>;
  /** Rows with no boundary (shown in a note, never dropped silently). */
  unmatched: RegionValue[];
}

/**
 * Matches rows to features by `key`, accepting the usual spellings of one region: the full code
 * ("US-NY"), its subdivision part ("NY"), the postal code or the name (case-insensitive).
 */
export function matchRegions(features: readonly Feature[], regions: readonly RegionValue[], key = 'code'): RegionMatch {
  const index = new Map<string, number>();
  features.forEach((f, i) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const own = featureKey(f, key);
    for (const k of [own, own.includes('-') ? own.split('-').pop() : '', normKey(p.postal), normKey(p.name), normKey(p.code)]) {
      if (k && !index.has(k)) index.set(k, i);
    }
  });
  const byFeature = new Map<number, RegionValue>();
  const unmatched: RegionValue[] = [];
  for (const r of regions) {
    const k = normKey(r.key);
    const i = index.get(k) ?? (k.includes('-') ? index.get(k.split('-').pop() ?? '') : undefined);
    if (i === undefined || byFeature.has(i)) unmatched.push(r);
    else byFeature.set(i, r);
  }
  return { byFeature, unmatched };
}

export type ClassMode = 'continuous' | 'quantize' | 'quantile';

/**
 * Class thresholds (`count - 1` upper bounds) for a choropleth: `quantize` splits the range in equal
 * intervals, `quantile` puts the same number of regions in each class. `continuous` returns no
 * thresholds: the value maps straight onto the 7-step ramp.
 */
export function classBreaks(values: readonly (number | null | undefined)[], mode: ClassMode, count: number): number[] {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (mode === 'continuous' || sorted.length < 2) return [];
  const n = Math.max(2, Math.min(RAMP_STEPS, Math.round(count)));
  const lo = sorted[0] as number;
  const hi = sorted[sorted.length - 1] as number;
  if (hi === lo) return [];
  const breaks =
    mode === 'quantize'
      ? Array.from({ length: n - 1 }, (_, i) => lo + ((i + 1) * (hi - lo)) / n)
      : Array.from({ length: n - 1 }, (_, i) => quantileSorted(sorted, (i + 1) / n) as number);
  // Ties in the data can repeat a quantile: keep each threshold once
  return breaks.filter((b, i) => i === 0 || b > (breaks[i - 1] as number));
}

/**
 * Ramp steps for map fills: 2..7. The first step sits too close to land and to "no data" to read as
 * a value on a map, so maps start one step in.
 */
export function mapSteps(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [RAMP_STEPS];
  return Array.from({ length: n }, (_, i) => 2 + Math.round((i * (RAMP_STEPS - 2)) / (n - 1)));
}

/** Map step (2..7) of a value within [min, max]; 0 for no data. */
export function mapStep(value: number | null | undefined, [min, max]: readonly [number, number]): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  if (max <= min) return RAMP_STEPS;
  return 2 + Math.min(RAMP_STEPS - 2, Math.floor(((value - min) / (max - min)) * (RAMP_STEPS - 1)));
}

/** Class index 0..breaks.length of a value (null for no data). */
export function classIndex(value: number | null | undefined, breaks: readonly number[]): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let i = 0;
  while (i < breaks.length && value > (breaks[i] as number)) i++;
  return i;
}

/* ─────────────────────────── tile grid ─────────────────────────── */

export interface TilePosition {
  key: string;
  col: number;
  row: number;
}

/**
 * Tiles of the countries present in `keys` (prefix before "-", e.g. "US", "CA"), with empty rows and
 * columns removed so a single country fills the grid.
 */
export function tilePositions(layout: Readonly<Record<string, readonly [number, number]>>, keys: readonly string[]): TilePosition[] {
  const prefix = (k: string) => (k.includes('-') ? k.split('-')[0] : '');
  const wanted = new Set(keys.map((k) => prefix(normKey(k))));
  const picked = Object.entries(layout)
    .filter(([k]) => wanted.size === 0 || wanted.has(prefix(normKey(k))) || wanted.has(''))
    .map(([key, [col, row]]) => ({ key: normKey(key), col, row }));
  const cols = [...new Set(picked.map((t) => t.col))].sort((a, b) => a - b);
  const rows = [...new Set(picked.map((t) => t.row))].sort((a, b) => a - b);
  return picked.map((t) => ({ key: t.key, col: cols.indexOf(t.col), row: rows.indexOf(t.row) }));
}

/* ─────────────────────────── marks ─────────────────────────── */

/** A spike: a thin triangle standing on its base point (x, y), `h` pixels tall. */
export function spikePath(x: number, y: number, h: number, width = 7): string {
  const w = width / 2;
  return `M${(x - w).toFixed(1)},${y.toFixed(1)}L${x.toFixed(1)},${(y - h).toFixed(1)}L${(x + w).toFixed(1)},${y.toFixed(1)}Z`;
}

/**
 * Where a globe opens: on the location that matters most (the largest value), its latitude kept
 * within ±40° so the view is never a pole. Returns the d3 rotation [λ, φ].
 */
export function globeRotation(lon: number, lat: number): [number, number] {
  return [-lon, -Math.max(-40, Math.min(40, lat))];
}

/** Labels that do not collide: greedy in the given order (most important first), boxes estimated from text length. */
export function placeLabels<T extends { x: number; y: number; text: string }>(items: readonly T[], charWidth = 6.2, height = 13): T[] {
  const boxes: Array<[number, number, number, number]> = [];
  return items.filter((it) => {
    const w = it.text.length * charWidth;
    const box: [number, number, number, number] = [it.x, it.y - height, it.x + w, it.y + 2];
    if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return false;
    boxes.push(box);
    return true;
  });
}

/** Whether a location faces the viewer on a globe rotated by [λ, φ]. */
export function onFrontHemisphere(rotate: readonly [number, number], lon: number, lat: number): boolean {
  return geoDistance([lon, lat], [-rotate[0], -rotate[1]]) < Math.PI / 2 - 1e-6;
}

/** A located value in screen space (for densities). */
export interface ScreenPoint {
  x: number;
  y: number;
  weight: number;
}

export interface HexBin {
  x: number;
  y: number;
  /** Sum of the weights (the count when points have no value). */
  total: number;
  count: number;
}

/** Hexagonal bins of screen points (pointy-top hexagons of `radius` px). */
export function hexbins(points: readonly ScreenPoint[], radius: number, width: number, height: number): HexBin[] {
  const h = hexbin<ScreenPoint>()
    .x((p) => p.x)
    .y((p) => p.y)
    .radius(radius)
    .extent([
      [0, 0],
      [width, height],
    ]);
  return h([...points]).map((bin) => ({ x: bin.x, y: bin.y, count: bin.length, total: bin.reduce((t, p) => t + p.weight, 0) }));
}

/** The hexagon outline for `radius` (relative to its centre). */
export const hexagonPath = (radius: number): string => hexbin().radius(radius).hexagon();

/** Weighted density bands of screen points (filled contours, lowest band first). */
export function densityBands(points: readonly ScreenPoint[], width: number, height: number, bandwidth = 18, bands = 6): Array<{ value: number; geometry: Geometry }> {
  if (!points.length) return [];
  const density = contourDensity<ScreenPoint>()
    .x((p) => p.x)
    .y((p) => p.y)
    .weight((p) => Math.max(0, p.weight))
    .size([Math.max(1, Math.round(width)), Math.max(1, Math.round(height))])
    .bandwidth(bandwidth)
    .thresholds(bands);
  return density([...points]).map((c) => ({ value: c.value, geometry: c }));
}

/** Three reference values for a size legend: the largest nice value ≤ max, then a half and a tenth of it. */
export function sizeLegendValues(max: number): number[] {
  if (!(max > 0)) return [];
  const mag = 10 ** Math.floor(Math.log10(max));
  const top = [5, 2, 1].map((m) => m * mag).find((v) => v <= max) ?? mag;
  return [top, top / 2, top / 10].filter((v) => v > 0);
}
