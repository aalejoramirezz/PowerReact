#!/usr/bin/env node
/**
 * Builds the boundary sets the map visuals draw (public/geo/), from Natural Earth (public domain).
 *
 * Run once when a set changes; the output is committed, so the app never fetches boundaries from
 * another host at run time. Downloads go to a fresh temporary folder and are only parsed as JSON.
 *
 *    node scripts/build-geo.mjs
 *
 *  - world-110m.topo.json  `countries`: every country (name, code = ISO 3166-1 alpha-3).
 *  - na-admin1.topo.json   `regions`: US states (+ DC) and Canadian provinces / territories
 *                          (name, code = ISO 3166-2 such as "US-NY", postal, country);
 *                          `context`: neighbouring countries drawn as plain land.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { filter, filterAttachedWeight, presimplify, quantile, simplify } from 'topojson-simplify';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'geo');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const NA = ['USA', 'CAN'];
const NA_CONTEXT = ['MEX', 'GRL', 'CUB', 'BHS', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'HTI', 'DOM', 'JAM', 'PRI'];

const work = mkdtempSync(path.join(tmpdir(), 'powerreact-geo-'));

async function download(name) {
  const res = await fetch(`${NE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(path.join(work, name), text);
  return JSON.parse(text);
}

const iso3 = (p) => [p.ISO_A3, p.ADM0_A3, p.adm0_a3].find((c) => typeof c === 'string' && /^[A-Z]{3}$/.test(c)) ?? '';
const feature = (f, properties) => ({ type: 'Feature', geometry: f.geometry, properties });

/**
 * Keeps `share` of the arc detail (by Visvalingam weight), drops detached islands smaller than
 * `minArea` square degrees (invisible at dashboard scale), removes the weights, then quantizes.
 */
function compact(objects, share, minArea = 0) {
  let t = topology(objects);
  if (share < 1) {
    t = simplify(presimplify(t), quantile(presimplify(t), 1 - share));
    if (minArea > 0) t = filter(t, filterAttachedWeight(t, minArea));
    t = { ...t, arcs: t.arcs.map((arc) => arc.map(([x, y]) => [x, y])) };
  }
  return quantize(t, 1e5);
}

function write(file, data) {
  const text = JSON.stringify(data);
  writeFileSync(path.join(OUT, file), text);
  console.log(`wrote public/geo/${file} (${Math.round(text.length / 1024)} KB)`);
}

try {
  const world = await download('ne_110m_admin_0_countries.geojson');
  const countries = world.features.map((f) => feature(f, { name: f.properties.NAME, code: iso3(f.properties) }));
  write('world-110m.topo.json', compact({ countries: { type: 'FeatureCollection', features: countries } }, 1));

  const admin1 = await download('ne_50m_admin_1_states_provinces.geojson');
  const regions = admin1.features
    .filter((f) => NA.includes(f.properties.adm0_a3))
    .map((f) =>
      feature(f, {
        name: f.properties.name,
        code: f.properties.iso_3166_2,
        postal: f.properties.postal,
        country: f.properties.adm0_a3,
      })
    );
  const admin0 = await download('ne_50m_admin_0_countries.geojson');
  const context = admin0.features
    .filter((f) => NA_CONTEXT.includes(iso3(f.properties)))
    .map((f) => feature(f, { name: f.properties.NAME, code: iso3(f.properties) }));
  write(
    'na-admin1.topo.json',
    compact({ regions: { type: 'FeatureCollection', features: regions }, context: { type: 'FeatureCollection', features: context } }, 0.06, 0.15)
  );
  console.log(`${countries.length} countries, ${regions.length} regions, ${context.length} context countries`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
