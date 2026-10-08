import { scaleUnit, type ScaleUnit } from './format';

/**
 * IBCS variance (port of Lens templates/deneb/ibcs_variance_*.vg.json).
 * Three aligned panels: AC vs comparison, ΔAbs bars, Δ% pins.
 */

export type Scenario = 'PY' | 'PL' | 'FC' | 'BU';

/** IBCS notation of the comparison series. AC is always solid in the title colour. */
export const SCENARIO_STYLE: Record<Scenario, { fill: boolean; fillOpacity: number; strokeWidth: number; dash: string }> = {
  PY: { fill: true, fillOpacity: 1, strokeWidth: 0, dash: '' }, // prior year: solid grey
  PL: { fill: false, fillOpacity: 0, strokeWidth: 1.5, dash: '' }, // plan: outlined
  FC: { fill: true, fillOpacity: 0.25, strokeWidth: 1.5, dash: '4 2' }, // forecast: dashed outline
  BU: { fill: false, fillOpacity: 0, strokeWidth: 1.5, dash: '1.5 2' }, // budget: dotted outline
};

/** Inline SVG style of a comparison bar in IBCS notation (the AC bar is solid `--pbi-ac`). */
export function scenarioStyle(scenario: Scenario): Record<string, string> {
  const st = SCENARIO_STYLE[scenario];
  return {
    fill: st.fill ? 'var(--pbi-secondary)' : 'transparent',
    fillOpacity: String(st.fillOpacity),
    stroke: 'var(--pbi-secondary)',
    strokeWidth: String(st.strokeWidth),
    ...(st.dash ? { strokeDasharray: st.dash } : {}),
  };
}

export interface IbcsDatum {
  id: string;
  label: string;
  actual: number | null;
  comparison: number | null;
}

export interface IbcsRow<T extends IbcsDatum> {
  datum: T;
  ac: number | null;
  cmp: number | null;
  /** AC − comparison (missing values count as 0, as in the Vega spec). */
  dabs: number;
  /** AC / |comparison| − sign(comparison); null when the comparison is missing or 0. */
  dpct: number | null;
  /** Favourable by business meaning (`goodWhen`), never by sign. */
  good: boolean;
}

const valid = (v: number | null): v is number => v !== null && Number.isFinite(v);

export function ibcsRows<T extends IbcsDatum>(
  data: readonly T[],
  {
    goodWhen = 'higher',
    sort = 'actual',
    topN = 0,
  }: { goodWhen?: 'higher' | 'lower'; sort?: 'actual' | 'variance' | 'natural'; topN?: number } = {}
): IbcsRow<T>[] {
  const rows = data
    .filter((d) => valid(d.actual) || valid(d.comparison))
    .map((datum) => {
      const ac = valid(datum.actual) ? datum.actual : null;
      const cmp = valid(datum.comparison) ? datum.comparison : null;
      const dabs = (ac ?? 0) - (cmp ?? 0);
      const dpct = cmp !== null && cmp !== 0 && ac !== null ? ac / Math.abs(cmp) - (cmp > 0 ? 1 : -1) : null;
      return { datum, ac, cmp, dabs, dpct, good: goodWhen === 'higher' ? dabs >= 0 : dabs <= 0 };
    });

  if (sort === 'actual') rows.sort((a, b) => (b.ac ?? -Infinity) - (a.ac ?? -Infinity));
  if (sort === 'variance') rows.sort((a, b) => b.dabs - a.dabs);
  return topN > 0 ? rows.slice(0, topN) : rows;
}

export interface IbcsScales {
  unit: ScaleUnit;
  /** Largest AC / comparison value (main panel domain is [0, mainMax]). */
  mainMax: number;
  /** ΔAbs domain, always containing 0. */
  absDomain: [number, number];
  /** Δ% domain clamped to ±pctCap, always containing 0. */
  pctDomain: [number, number];
}

export function ibcsScales(rows: readonly IbcsRow<IbcsDatum>[], pctCap = 2): IbcsScales {
  const mainMax = rows.reduce((m, r) => Math.max(m, r.ac ?? 0, r.cmp ?? 0), 0) || 1;
  const dmin = Math.min(0, ...rows.map((r) => r.dabs));
  const dmax = Math.max(0, ...rows.map((r) => r.dabs));
  const pcts = rows.map((r) => r.dpct).filter((v): v is number => v !== null);
  const pmin = Math.min(0, ...pcts);
  const pmax = Math.max(0, ...pcts);
  const maxAbs = Math.max(mainMax, Math.abs(dmin), Math.abs(dmax));
  const plo = Math.max(pmin, -pctCap);
  const phi = Math.min(pmax, pctCap);
  return {
    unit: scaleUnit(maxAbs),
    mainMax,
    absDomain: [dmin, dmax === dmin ? dmin + 1 : dmax],
    pctDomain: [plo, phi === plo ? plo + 1 : phi],
  };
}

export interface PctMarker {
  /** Δ% drawn (clamped to the cap). */
  value: number;
  shape: 'circle' | 'triangle-out' | 'none';
  /** True when the real Δ% exceeds the cap: drawn at the axis edge as a triangle with its real label. */
  capped: boolean;
}

export function pctMarker(dpct: number | null, pctCap = 2): PctMarker {
  if (dpct === null) return { value: 0, shape: 'none', capped: false };
  if (Math.abs(dpct) > pctCap) return { value: Math.sign(dpct) * pctCap, shape: 'triangle-out', capped: true };
  return { value: dpct, shape: 'circle', capped: false };
}
