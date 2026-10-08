/**
 * Declarative number formats (`FormatSpec`). Not named "format-spec.ts": Stencil skips any module
 * whose output path contains "spec." (it assumes a Jest spec file), so it would never be bundled.
 *
 * Declarative number formats: a manifest (JSON) cannot carry a formatting function, so every
 * element takes a `format` object and turns it into Intl.NumberFormat (en-US, the display locale).
 */

export type FormatStyle = 'integer' | 'decimal' | 'percent' | 'currency' | 'compact';

export interface FormatSpec {
  style: FormatStyle;
  /** Fraction digits. Defaults: integer 0, decimal 1, percent 1, currency 0, compact up to 1. */
  decimals?: number;
  /** ISO 4217 code for `currency` (default USD). */
  currency?: string;
}

export const INTEGER: FormatSpec = { style: 'integer' };

/** Text for a missing value (null, NaN, ±Infinity). */
export const MISSING = '—';

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(spec: FormatSpec): Intl.NumberFormat {
  const key = `${spec.style}|${spec.decimals ?? ''}|${spec.currency ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fixed = (fallback: number) => {
    const d = clampDecimals(spec.decimals ?? fallback);
    return { minimumFractionDigits: d, maximumFractionDigits: d };
  };
  let options: Intl.NumberFormatOptions;
  switch (spec.style) {
    case 'decimal':
      options = fixed(1);
      break;
    case 'percent':
      options = { style: 'percent', ...fixed(1) };
      break;
    case 'currency':
      options = { style: 'currency', currency: (spec.currency ?? 'USD').toUpperCase(), ...fixed(0) };
      break;
    case 'compact':
      options = { notation: 'compact', maximumFractionDigits: clampDecimals(spec.decimals ?? 1) };
      break;
    default:
      options = { maximumFractionDigits: clampDecimals(spec.decimals ?? 0) };
  }
  const nf = new Intl.NumberFormat('en-US', options);
  cache.set(key, nf);
  return nf;
}

const clampDecimals = (d: number) => Math.max(0, Math.min(6, Math.round(d)));

/** Formats a value; null / non-finite values render as an em dash. */
export function formatValue(value: number | null | undefined, spec: FormatSpec = INTEGER): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return numberFormat(spec).format(value);
}

/** A reusable formatter function for chart labels and ticks. */
export function formatter(spec: FormatSpec = INTEGER): (value: number) => string {
  return (value) => formatValue(value, spec);
}
