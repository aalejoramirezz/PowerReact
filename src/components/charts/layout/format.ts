/** Number formatting shared by every chart (en-US, the app's display locale). */

const nf = (options: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options);

export const formatInteger = (v: number) => nf({ maximumFractionDigits: 0 }).format(v);

export const formatNumber = (v: number, decimals = 0) =>
  nf({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

export const formatPercent = (fraction: number, decimals = 1) =>
  nf({ style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(fraction);

/** Explicit sign with a true minus (U+2212), as IBCS labels do. */
export function formatSigned(v: number, format: (abs: number) => string): string {
  if (v > 0) return `+${format(v)}`;
  if (v < 0) return `−${format(-v)}`;
  return format(0);
}

export interface ScaleUnit {
  divisor: number;
  suffix: '' | 'K' | 'M' | 'bn';
}

/** One unit for every label of a chart (IBCS principle 39). K only from 10,000 so small counts stay exact. */
export function scaleUnit(maxAbs: number): ScaleUnit {
  if (maxAbs >= 1e9) return { divisor: 1e9, suffix: 'bn' };
  if (maxAbs >= 1e6) return { divisor: 1e6, suffix: 'M' };
  if (maxAbs >= 1e4) return { divisor: 1e3, suffix: 'K' };
  return { divisor: 1, suffix: '' };
}
