/**
 * Colour by role, never by value: every function returns a `var(--pbi-…)` reference to a token in
 * src/theme/tokens.css. Charts never interpolate colours in JS (both themes stay in CSS).
 */

/** Categorical (nominal series: channels, statuses), ordered sequential (low → high) or diverging (bad ↔ good). */
export type PaletteKind = 'categorical' | 'sequential' | 'diverging';

export const CATEGORICAL_SLOTS = 6;
export const RAMP_STEPS = 7;

/** Fill for "Other" (folded series) and anything that is context, not data. */
export const OTHER_FILL = 'var(--pbi-neutral)';

/** Evenly spread `n` picks over the 1..7 ramp, keeping both ends (n = 3 → 1, 4, 7). */
export function rampSteps(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [RAMP_STEPS];
  return Array.from({ length: n }, (_, i) => 1 + Math.round((i * (RAMP_STEPS - 1)) / (n - 1)));
}

/**
 * Diverging picks, symmetric around the neutral middle: each side takes the steps nearest its end
 * (1, 2, 3 and 7, 6, 5), so the inner grades stay clearly coloured; an odd count puts its middle
 * one on the neutral step 4. Beyond 7 the extra series repeat the outer steps.
 */
export function divergingSteps(n: number): number[] {
  if (n <= 0) return [];
  const side = Math.floor(n / 2);
  const low = Array.from({ length: side }, (_, i) => Math.min(3, 1 + i));
  return [...low, ...(n % 2 === 1 ? [4] : []), ...low.map((k) => 8 - k).reverse()];
}

export interface SeriesColour {
  fill: string;
  /** Label colour on that fill (≥ 4.5:1). */
  text: string;
}

/** Colour of series `i` of `n` in a palette. */
export function seriesColour(i: number, n: number, kind: PaletteKind = 'categorical'): SeriesColour {
  if (kind === 'sequential') {
    const k = rampSteps(n)[i] ?? RAMP_STEPS;
    return { fill: `var(--pbi-seq-${k})`, text: `var(--pbi-seq-text-${k})` };
  }
  if (kind === 'diverging') {
    const k = divergingSteps(n)[i] ?? 4;
    return { fill: `var(--pbi-div-${k})`, text: `var(--pbi-div-text-${k})` };
  }
  const slot = (i % CATEGORICAL_SLOTS) + 1;
  return { fill: `var(--pbi-series-${slot})`, text: 'var(--pbi-title)' };
}

/** Colour of a ramp step (1..7) for heat cells. */
export function rampColour(step: number, kind: 'sequential' | 'diverging' = 'sequential'): SeriesColour {
  const k = Math.min(RAMP_STEPS, Math.max(1, Math.round(step)));
  return kind === 'diverging'
    ? { fill: `var(--pbi-div-${k})`, text: `var(--pbi-div-text-${k})` }
    : { fill: `var(--pbi-seq-${k})`, text: `var(--pbi-seq-text-${k})` };
}
