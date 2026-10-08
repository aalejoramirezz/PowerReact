import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The udp-powerbi-visuals elements read every colour, font and motion role as --pbi-<role>, declared
 * once in styles/tokens-bridge.css as var(--u-<role>, <Fluent fallback>): the Univerus template here,
 * the platform theme inside UDP. These checks keep the bridge complete and the package off --u-*.
 */
const PKG = 'packages/udp-powerbi-visuals/src';
const BRIDGE = path.join(PKG, 'styles/tokens-bridge.css');

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(f) && !f.endsWith('components.d.ts') && !f.endsWith('.test.ts') ? [p] : [];
  });

const bridge = readFileSync(BRIDGE, 'utf8');
const entries = new Map([...bridge.matchAll(/--pbi-([a-z0-9-]+):\s*var\(--u-([a-z0-9-]+),\s*(.+?)\);/g)].map((m) => [m[1] as string, { source: m[2], fallback: m[3] ?? '' }]));
const sources = files(PKG).filter((f) => path.normalize(f) !== path.normalize(BRIDGE));

/** Geometry / motion roles may fall back to a plain value; every other role to a Fluent token. */
const PLAIN_FALLBACK = new Set(['card-blur', 'card-hover-lift', 'grid-dash', 'bar-glow', 'curtain-glow', 'area-opacity', 'focus-ring']);

describe('udp-powerbi-visuals token bridge', () => {
  it('maps each --pbi-<role> to its own --u-<role> with a Fluent fallback', () => {
    expect(entries.size).toBeGreaterThan(100);
    const mismatched = [...entries].filter(([role, e]) => e.source !== role).map(([role]) => role);
    const notFluent = [...entries]
      .filter(([role, e]) => !PLAIN_FALLBACK.has(role) && !/var\(--(color|font|curve|borderRadius|spacing|shadow)/.test(e.fallback))
      .map(([role]) => role);
    const empty = [...entries].filter(([, e]) => !e.fallback.trim()).map(([role]) => role);
    expect({ mismatched, notFluent, empty }).toEqual({ mismatched: [], notFluent: [], empty: [] });
  });

  it('declares every role an element reads, including every step of the ramps', () => {
    const used = new Set<string>();
    // Greedy: `var(--pbi-series-${k})` reads as the family "series-", checked step by step below
    for (const f of sources) for (const m of readFileSync(f, 'utf8').matchAll(/var\(--pbi-([a-z0-9-]+)/g)) used.add(m[1] as string);
    const steps = (family: string, n: number) => Array.from({ length: n }, (_, i) => `${family}-${i + 1}`);
    const ramps = [...steps('series', 6), ...steps('seq', 7), ...steps('seq-text', 7), ...steps('div', 7), ...steps('div-text', 7)];
    const missing = [...[...used].filter((r) => !r.endsWith('-')), ...ramps].filter((r) => !entries.has(r));
    expect(missing).toEqual([]);
  });

  it('keeps the package off the Univerus names (only the bridge reads --u-*)', () => {
    const offenders = sources.filter((f) => /var\(--u-/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
