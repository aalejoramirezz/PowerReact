import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Topology } from 'topojson-specification';
import {
  borders,
  classBreaks,
  classIndex,
  fitProjection,
  globeRotation,
  hexbins,
  mapStep,
  mapSteps,
  lonSpan,
  matchRegions,
  onFrontHemisphere,
  pickProjection,
  placeLabels,
  pointsTarget,
  sizeLegendValues,
  spikePath,
  tilePositions,
  toFeatures,
  densityBands,
} from './geo';
import { bulletModel, kpiVariance, sparkline } from './kpi';

const NA = JSON.parse(readFileSync('public/geo/na-admin1.topo.json', 'utf8')) as Topology;
const TILES = (JSON.parse(readFileSync('public/geo/na-tiles.json', 'utf8')) as { tiles: Record<string, [number, number]> }).tiles;

describe('geography', () => {
  it('reads features from a topology object (or its first object) and from GeoJSON', () => {
    const regions = toFeatures(NA, 'regions');
    expect(regions).toHaveLength(64);
    expect(toFeatures(NA).length).toBe(64);
    expect(toFeatures(NA, 'context').length).toBeGreaterThan(5);
    expect(toFeatures({ type: 'FeatureCollection', features: regions.slice(0, 2) })).toHaveLength(2);
    expect(toFeatures(null)).toEqual([]);
  });

  it('draws shared borders once: inner (same country) and outer (between countries, coasts)', () => {
    const { inner, outer } = borders(NA, 'regions');
    expect(inner?.coordinates.length).toBeGreaterThan(10);
    expect(outer?.coordinates.length).toBeGreaterThan(10);
    expect(borders({ type: 'FeatureCollection', features: [] })).toEqual({ inner: null, outer: null });
  });

  it('picks the projection by extent and crosses the antimeridian correctly', () => {
    expect(pickProjection([[-123.2, 49.2], [-123.0, 49.3]])).toBe('mercator');
    expect(pickProjection([[-123.5, 39.6], [-71.3, 49.4]])).toBe('conic');
    expect(pickProjection([[-180, -60], [180, 85]])).toBe('equal-earth');
    expect(lonSpan([[170, 50], [-170, 60]])).toBe(20);
  });

  it('pads a single location so it still gets a map, and fits projections inside the box', () => {
    const one = pointsTarget([{ lat: 49.28, lon: -123.12 }]);
    expect(one?.coordinates).toHaveLength(4);
    expect(pointsTarget([])).toBeNull();
    const target = pointsTarget([
      { lat: 49.41, lon: -123.52 },
      { lat: 40.79, lon: -73.7 },
      { lat: 30.33, lon: -81.66 },
    ]);
    const { projection, kind } = fitProjection('auto', target as never, { width: 600, height: 360 });
    expect(kind).toBe('conic');
    for (const [lon, lat] of [[-123.52, 49.41], [-73.7, 40.79], [-81.66, 30.33]] as const) {
      const [x, y] = projection([lon, lat]) as [number, number];
      expect(x).toBeGreaterThanOrEqual(11);
      expect(x).toBeLessThanOrEqual(589);
      expect(y).toBeGreaterThanOrEqual(11);
      expect(y).toBeLessThanOrEqual(349);
    }
    // Nothing to fit (boundaries not loaded yet): a valid view of the whole sphere
    const empty = fitProjection('globe', { type: 'FeatureCollection', features: [] } as never, { width: 300, height: 300 });
    expect(empty.projection([10, 10])?.every(Number.isFinite)).toBe(true);
    const globe = fitProjection('globe', target as never, { width: 400, height: 400 });
    expect(globe.kind).toBe('globe');
    expect(globe.projection.rotate()[0]).toBeGreaterThan(80);
  });

  it('matches regions by ISO code, subdivision part, postal code or name, and reports the rest', () => {
    const regions = toFeatures(NA, 'regions');
    const { byFeature, unmatched } = matchRegions(regions, [
      { key: 'US-NY', value: 1 },
      { key: 'bc', value: 2 },
      { key: 'Florida', value: 3 },
      { key: 'AU-VIC', value: 4 },
      { key: 'US-NY', value: 5 },
    ]);
    const names = [...byFeature.entries()].map(([i, r]) => [(regions[i]?.properties as { name?: string } | null | undefined)?.name, r.value]);
    expect(names).toEqual([
      ['New York', 1],
      ['British Columbia', 2],
      ['Florida', 3],
    ]);
    // An unknown region and a duplicate are listed, never dropped silently
    expect(unmatched.map((r) => r.value)).toEqual([4, 5]);
  });

  it('classes values in equal intervals or equal counts', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null];
    expect(classBreaks(values, 'quantize', 3)).toEqual([4, 7]);
    expect(classBreaks(values, 'quantile', 2)).toEqual([5.5]);
    expect(classBreaks(values, 'continuous', 5)).toEqual([]);
    expect(classBreaks([3, 3, 3], 'quantile', 4)).toEqual([]);
    expect(classIndex(4, [4, 7])).toBe(0);
    expect(classIndex(4.1, [4, 7])).toBe(1);
    expect(classIndex(10, [4, 7])).toBe(2);
    expect(classIndex(null, [4, 7])).toBeNull();
  });

  it('lays out tiles only for the countries in the data, compacting empty rows and columns', () => {
    const all = tilePositions(TILES, ['US-NY', 'CA-BC']);
    expect(all).toHaveLength(64);
    const us = tilePositions(TILES, ['US-NY', 'US-FL']);
    expect(us).toHaveLength(51);
    expect(Math.min(...us.map((t) => t.row))).toBe(0);
    expect(us.find((t) => t.key === 'US-AK')).toEqual({ key: 'US-AK', col: 0, row: 0 });
  });

  it('draws spikes, hides the far side of a globe and starts map ramps one step in', () => {
    expect(mapSteps(5)).toEqual([2, 3, 5, 6, 7]);
    expect([mapStep(0, [0, 10]), mapStep(10, [0, 10]), mapStep(null, [0, 10])]).toEqual([2, 7, 0]);
    expect(spikePath(10, 50, 20, 6)).toBe('M7.0,50.0L10.0,30.0L13.0,50.0Z');
    expect(onFrontHemisphere([100, -45], -100, 45)).toBe(true);
    expect(onFrontHemisphere([100, -45], 80, -45)).toBe(false);
  });

  it('opens a globe on a location without showing a pole, and keeps labels apart', () => {
    expect(globeRotation(-74, 40.7)).toEqual([74, -40]);
    expect(globeRotation(151.2, -33.9)).toEqual([-151.2, 33.9]);
    const kept = placeLabels([
      { x: 100, y: 100, text: 'Toronto' },
      { x: 104, y: 104, text: 'New York' },
      { x: 300, y: 100, text: 'London' },
    ]);
    expect(kept.map((l) => l.text)).toEqual(['Toronto', 'London']);
  });

  it('bins and contours screen points; picks three size-legend values', () => {
    const pts = [
      { x: 10, y: 10, weight: 2 },
      { x: 12, y: 11, weight: 3 },
      { x: 90, y: 90, weight: 1 },
    ];
    const bins = hexbins(pts, 10, 100, 100);
    expect(bins).toHaveLength(2);
    expect(bins.find((b) => b.count === 2)?.total).toBe(5);
    expect(densityBands(pts, 100, 100, 10, 4).length).toBeGreaterThan(0);
    expect(sizeLegendValues(172)).toEqual([100, 50, 10]);
    expect(sizeLegendValues(0)).toEqual([]);
  });
});

describe('KPI layouts', () => {
  const series = [
    { label: 'Jan', value: 10 },
    { label: 'Feb', value: null },
    { label: 'Mar', value: 4 },
    { label: 'Apr', value: 14 },
  ];

  it('the sparkline keeps blanks as gaps, marks min / max / last and keeps the target in view', () => {
    const s = sparkline(series, 120, 40, { target: 20 });
    expect(s.points.map((p) => p.label)).toEqual(['Jan', 'Mar', 'Apr']);
    expect([s.min, s.max, s.last]).toEqual([1, 2, 2]);
    expect(s.targetY).not.toBeNull();
    expect(s.targetY as number).toBeLessThan(s.points[2]?.y as number);
    expect(s.line.split('M').length - 1).toBe(2);
    const flat = sparkline([{ label: 'a', value: 5 }, { label: 'b', value: 5 }], 100, 30);
    expect(flat.domain[0]).toBeLessThan(5);
  });

  it('the bullet derives bands from thresholds and the status from the value', () => {
    const higher = bulletModel({ value: 94.2, target: 95, thresholds: [85, 92], goodWhen: 'higher' });
    expect(higher.bands.map((b) => b.quality)).toEqual(['poor', 'fair', 'good']);
    // In the good band but short of the target: not "on target" yet
    expect(higher.status).toBe('warn');
    expect(higher.gap).toBeCloseTo(-0.8);
    expect(higher.max).toBeGreaterThanOrEqual(95);
    expect(bulletModel({ value: 96, target: 95, thresholds: [85, 92] }).status).toBe('ok');
    expect(bulletModel({ value: 92, thresholds: [85, 92] }).status).toBe('ok');
    // Shares end at 100 %, with few ticks
    const share = bulletModel({ value: 0.942, target: 0.95, thresholds: [0.85, 0.92], ratio: true });
    expect([share.max, share.ticks]).toEqual([1, [0, 0.5, 1]]);
    const lower = bulletModel({ value: 30, target: 20, thresholds: [20, 40], max: 60, goodWhen: 'lower' });
    expect(lower.bands.map((b) => b.quality)).toEqual(['good', 'fair', 'poor']);
    expect([lower.status, lower.max]).toEqual(['warn', 60]);
    expect(bulletModel({ value: 8, target: 10 }).status).toBe('bad');
    expect(bulletModel({ value: null, target: 10 }).status).toBeNull();
  });

  it('the variance is absolute and relative, judged by goodWhen', () => {
    expect(kpiVariance(110, 100)).toEqual({ delta: 10, deltaPct: 0.1, favourable: true, barMax: 110 });
    expect(kpiVariance(110, 100, 'lower').favourable).toBe(false);
    expect(kpiVariance(5, 0).deltaPct).toBeNull();
    expect(kpiVariance(null, 3)).toMatchObject({ delta: null, favourable: null });
  });
});
