import type { FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';
import { getJson } from '../../api/http';

/**
 * Boundary sets the map visuals draw, served from this app's own origin (public/geo, built by
 * scripts/build-geo.mjs from Natural Earth). The elements never fetch: the container loads a set
 * here and passes it as `geometry`.
 */

/** One entry of public/geo/index.json. */
export interface GeoSet {
  id: string;
  label: string;
  file: string;
  /** Topology object holding the regions. */
  object: string;
  /** Topology object drawn as neighbouring land. */
  context?: string;
  /** Feature property region keys match (e.g. "code" = ISO 3166). */
  key: string;
  /** Tile grid file for the equal-area cartogram. */
  tiles?: string;
  attribution: string;
}

export interface GeoAsset {
  geometry: Topology | FeatureCollection;
  object?: string;
  context?: string;
  key?: string;
  /** Region code → [column, row]. */
  tileLayout?: Record<string, [number, number]>;
  attribution?: string;
}

export const GEO_INDEX_URL = '/geo/index.json';

/** A boundary file under /geo/ (a plain .json file name; no paths outside the folder). */
export function geoFileUrl(file: string): string {
  if (!/^[\w.-]+\.json$/.test(file) || file.includes('..')) throw new Error(`Not a boundary file in /geo/: ${file}`);
  return `/geo/${file}`;
}

/**
 * Resolves a set: an id from the catalogue ("world", "north-america") or a custom file in /geo/
 * ("service-areas.topo.json", read with its first object).
 */
export async function loadGeoAsset(set: string, signal?: AbortSignal): Promise<GeoAsset> {
  if (set.endsWith('.json')) {
    const geometry = await getJson<Topology | FeatureCollection>(geoFileUrl(set), signal);
    return { geometry };
  }
  const index = await getJson<{ sets: GeoSet[] }>(GEO_INDEX_URL, signal);
  const entry = index.sets.find((s) => s.id === set);
  if (!entry) throw new Error(`Unknown boundary set "${set}" (known: ${index.sets.map((s) => s.id).join(', ')})`);
  const [geometry, tiles] = await Promise.all([
    getJson<Topology>(geoFileUrl(entry.file), signal),
    entry.tiles ? getJson<{ tiles: Record<string, [number, number]> }>(geoFileUrl(entry.tiles), signal) : Promise.resolve(null),
  ]);
  return { geometry, object: entry.object, context: entry.context, key: entry.key, tileLayout: tiles?.tiles, attribution: entry.attribution };
}
