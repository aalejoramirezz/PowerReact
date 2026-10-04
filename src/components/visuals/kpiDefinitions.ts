import type { CurtainContent } from '../ui/InfoCurtain';

/**
 * "What it means" / "how it is calculated" for the hover curtains (principle 35).
 *
 * `info` comes from the measure descriptions in the semantic model (EVALUATE INFO.VIEW.MEASURES(),
 * read 2026-10-04). Measures without a description in the model are marked `pendingModelDescription`:
 * the wording is neutral and should be replaced once the model documents them.
 * `calc` names the measure: the Service Principal cannot read DAX expressions.
 */
export const KPI_DEFINITIONS = {
  totalAssets: {
    info: 'Assets in the register across all asset states, for the current group and class filters.',
    calc: '[Asset Count (All States)]',
    pendingModelDescription: true,
  },
  assessed: {
    info: 'Assets that have received at least one physical condition assessment (Condition_Index > 0).',
    calc: '[Assets Assessed For Condition] · % = [% Assessed For Condition]',
    pendingModelDescription: false,
  },
  renewal: {
    info: 'Assets whose reportable renewal date is on or before today and have a valid base life (> 2 years).',
    calc: '[Assets Due For Renewal]',
    pendingModelDescription: false,
  },
  baseLife: {
    info: 'Average base (useful) life of the assets in scope, in years.',
    calc: '[Avg Base Life (Years)]',
    pendingModelDescription: true,
  },
} satisfies Record<string, CurtainContent & { pendingModelDescription: boolean }>;

export const CHART_DEFINITIONS = {
  groups: {
    info: 'Assets per asset class group. The share is each group’s part of all assets the chart receives (narrowed by the class filter).',
    calc: "[Asset Count (All States)] by 'asset_class_group'[Asset_Class_Group]",
  },
  classes: {
    info: 'Asset classes by inventory for the current group. Search and KPI focus run in the model before the top 35 are taken.',
    calc: "TOPN(35, SUMMARIZECOLUMNS('asset_class'[Asset_Class], …), [AssetCount])",
  },
} satisfies Record<string, CurtainContent>;
