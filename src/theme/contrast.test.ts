import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast report for the design tokens (Lens `univerus_theme.py` does the same for Power BI).
 * Text is measured over the opaque card (`--u-card-solid`); translucent colours are blended first.
 */

type RGBA = [number, number, number, number];

const css = readFileSync('src/theme/tokens.css', 'utf8');

function block(selector: string): string {
  const start = css.indexOf('{', css.indexOf(selector));
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  throw new Error(`unterminated block ${selector}`);
}

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--u-([\w-]+):\s*([^;]+);/g)) {
    if (m[1] && m[2]) out[m[1]] = m[2].trim();
  }
  return out;
}

const NEOGLASS = tokens(block(":root[data-theme='neoglass']"));
const NOCTURNE = { ...NEOGLASS, ...tokens(block(":root[data-theme='nocturne']")) };

function parse(color: string | undefined): RGBA {
  if (!color) throw new Error('missing token');
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgba?.[1]) {
    const [r = 0, g = 0, b = 0, a = 1] = rgba[1].split(',').map(Number);
    return [r, g, b, a];
  }
  throw new Error(`not a plain colour: ${color}`);
}

const blend = (fg: RGBA, bg: RGBA): RGBA => [
  fg[0] * fg[3] + bg[0] * (1 - fg[3]),
  fg[1] * fg[3] + bg[1] * (1 - fg[3]),
  fg[2] * fg[3] + bg[2] * (1 - fg[3]),
  1,
];

function luminance([r, g, b]: RGBA): number {
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(t: Record<string, string>, fg: string, bg: string, under = 'card-solid'): number {
  const base = parse(t[under]);
  let back = parse(t[bg]);
  if (back[3] < 1) back = blend(back, base);
  let front = parse(t[fg]);
  if (front[3] < 1) front = blend(front, back);
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Body text, numbers, chips and controls: WCAG AA 4.5:1 in both themes. */
const AA_PAIRS: Array<[string, string, string?]> = [
  ['title', 'card-solid'],
  ['text', 'card-solid'],
  ['text-soft', 'card-solid'],
  ['td-text', 'card-solid'],
  ['th-text', 'th-bg'],
  ['ok-text', 'ok-bg'],
  ['warn-text', 'warn-bg'],
  ['bad-text', 'bad-bg'],
  ['delta-up', 'card-solid'],
  ['delta-down', 'card-solid'],
  ['interaction', 'card-solid'],
  ['curtain-accent', 'card-solid'],
  ['eyebrow', 'card-solid'],
  ['btn-text', 'btn-bg'],
  ['tooltip-text', 'tooltip-bg'],
  ['tab-active-text', 'tab-active-bg'],
  ['tab-text', 'tab-bg'],
  ['tab-hover-text', 'tab-hover-bg'],
  ['shell-header-text', 'shell-header-bg'],
  ['shell-header-muted', 'shell-header-bg'],
  ['sidebar-text', 'sidebar-bg'],
  ['sidebar-active-text', 'sidebar-active-bg', 'sidebar-bg'],
  ['code-text', 'code-bg'],
  ['code-accent', 'code-bg'],
];

/**
 * Secondary text the Lens spec fixes exactly (Neo-Glass subtitle #819095, label/axis #748388:
 * 3.3–3.9:1, "used because they were specified exactly"). Held to the 3:1 floor; Nocturne passes AA.
 */
const SECONDARY_PAIRS: Array<[string, string]> = [
  ['subtitle', 'card-solid'],
  ['label', 'card-solid'],
  ['axis', 'card-solid'],
  ['mark-fg', 'mark-bg'],
];

describe.each([
  ['neoglass', NEOGLASS],
  ['nocturne', NOCTURNE],
] as const)('%s tokens', (_name, theme) => {
  it.each(AA_PAIRS)('%s on %s reaches 4.5:1', (fg, bg, under) => {
    expect(contrast(theme, fg, bg, under)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SECONDARY_PAIRS)('%s on %s reaches 3:1', (fg, bg) => {
    expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

/** Place names and values drawn straight on a map (land, water, regions without data). */
const MAP_PAIRS: Array<[string, string]> = [
  ['text', 'map-land'],
  ['text', 'map-water'],
  ['text', 'map-nodata'],
];

describe.each([
  ['neoglass', NEOGLASS],
  ['nocturne', NOCTURNE],
] as const)('%s map surfaces', (_name, theme) => {
  it.each(MAP_PAIRS)('%s on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('water and regions without data stay closer to the card than the ramp (data always reads as data)', () => {
    const fromCard = (role: string) => contrast(theme, role, 'card-solid');
    for (const role of ['map-water', 'map-nodata']) expect(fromCard(role)).toBeLessThan(fromCard('seq-3'));
  });
});

/** Labels drawn on heatmap / treemap cells: every step of both ramps carries its own text role. */
const RAMP_PAIRS: Array<[string, string]> = [1, 2, 3, 4, 5, 6, 7].flatMap((k) => [
  [`seq-text-${k}`, `seq-${k}`] as [string, string],
  [`div-text-${k}`, `div-${k}`] as [string, string],
]);

describe.each([
  ['neoglass', NEOGLASS],
  ['nocturne', NOCTURNE],
] as const)('%s ramps', (_name, theme) => {
  it.each(RAMP_PAIRS)('%s on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('the sequential ramp is ordered: each step moves further from the card than the last', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7].map((k) => contrast(theme, `seq-${k}`, 'card-solid'));
    for (let k = 1; k < steps.length; k++) expect(steps[k]).toBeGreaterThan(steps[k - 1] as number);
  });
});

it('nocturne secondary text reaches AA over the dark card', () => {
  for (const [fg, bg] of SECONDARY_PAIRS) {
    expect(contrast(NOCTURNE, fg, bg)).toBeGreaterThanOrEqual(4.5);
  }
});

it('an element can pin either template with data-theme (the theme prop of the web components)', () => {
  expect(css).toMatch(/,\s*\[data-theme='neoglass'\]\s*\{/);
  expect(css).toMatch(/,\s*\[data-theme='nocturne'\]\s*\{/);
});

it('both themes define the same roles', () => {
  const dark = tokens(block(":root[data-theme='nocturne']"));
  const missing = Object.keys(dark).filter((k) => !(k in NEOGLASS));
  expect(missing).toEqual([]);
});
