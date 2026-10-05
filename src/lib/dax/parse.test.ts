import { describe, expect, it } from 'vitest';
import { EMPTY_KPIS, parseClasses, parseGroups, parseKpis, toNumber } from './parse';

describe('toNumber', () => {
  it.each([
    [42, 42],
    ['3.5', 3.5],
    [null, 0],
    [undefined, 0],
    ['', 0],
    ['abc', 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('%p -> %p', (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe('parseKpis', () => {
  it('maps executeQueries measure keys', () => {
    expect(
      parseKpis([
        {
          '[TotalAssets]': 10000,
          '[TotalAssessed]': 8000,
          '[DueForRenewal]': 637,
          '[AvgBaseLife]': 42.349,
          '[PctAssessed]': 0.8,
        },
      ])
    ).toEqual({ totalAssets: 10000, totalAssessed: 8000, dueForRenewal: 637, avgBaseLife: 42.3, pctAssessed: 0.8 });
  });

  it('derives the assessed ratio when the measure is blank', () => {
    const kpis = parseKpis([{ '[TotalAssets]': 200, '[TotalAssessed]': 50, '[PctAssessed]': null }]);
    expect(kpis.pctAssessed).toBe(0.25);
    expect(kpis.dueForRenewal).toBe(0);
  });

  it('returns zeros for an empty result', () => {
    expect(parseKpis([])).toEqual(EMPTY_KPIS);
  });
});

describe('parseGroups', () => {
  const rows = [
    { 'asset_class_group[Asset_Class_Group]': 'Core', '[AssetCount]': 1000, '[Assessed]': 500, '[DueForRenewal]': 0 },
    {
      'asset_class_group[Asset_Class_Group]': 'Utility_Line',
      '[AssetCount]': 3000,
      '[Assessed]': 2700,
      '[DueForRenewal]': 637,
    },
    { 'asset_class_group[Asset_Class_Group]': null, '[AssetCount]': 1000, '[Assessed]': null, '[DueForRenewal]': null },
  ];

  it('sorts by inventory and computes shares over the sum of all groups', () => {
    const groups = parseGroups(rows);
    expect(groups.map((g) => g.group)).toEqual(['Utility_Line', 'Core', 'Unknown']);
    expect(groups.map((g) => g.share)).toEqual([0.6, 0.2, 0.2]);
    expect(groups[0]).toMatchObject({ assessed: 2700, dueForRenewal: 637, pctAssessed: 0.9 });
  });

  it('shares sum to 1 regardless of the KPI scope', () => {
    const total = parseGroups(rows).reduce((sum, g) => sum + g.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it('handles an empty result', () => {
    expect(parseGroups([])).toEqual([]);
  });
});

describe('parseClasses', () => {
  it('maps class rows and sorts them by inventory', () => {
    const classes = parseClasses([
      { 'asset_class[Asset_Class]': 'Hydrants', '[AssetCount]': 10, '[Assessed]': 0, '[DueForRenewal]': 0 },
      { 'asset_class[Asset_Class]': 'Water_Pipes', '[AssetCount]': 1979, '[Assessed]': 1840, '[DueForRenewal]': 637 },
    ]);
    expect(classes.map((c) => c.className)).toEqual(['Water_Pipes', 'Hydrants']);
    expect(classes[0]?.pctAssessed).toBeCloseTo(0.9298, 4);
    expect(classes[1]?.pctAssessed).toBe(0);
  });
});
