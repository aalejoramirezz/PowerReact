import { describe, expect, it } from 'vitest';
import { buildClassesQuery, buildGroupsQuery, buildKpiQuery, CLASS_LIMIT, daxLiteral, daxString, treatAs } from './daxBuilder';

describe('daxString', () => {
  it('wraps values in quotes and doubles embedded quotes', () => {
    expect(daxString('Water_Pipes')).toBe('"Water_Pipes"');
    expect(daxString('6" Mains')).toBe('"6"" Mains"');
  });

  it('keeps injected DAX inside the string literal', () => {
    const literal = daxString('x"}), EVALUATE ROW("pwned", 1) //');
    expect(literal).toBe('"x""}), EVALUATE ROW(""pwned"", 1) //"');
    expect(treatAs('x"}', 'T[C]')).toBe('TREATAS({"x""}"}, T[C])');
  });
});

describe('daxLiteral / treatAs', () => {
  it('writes typed literals', () => {
    expect(daxLiteral('Core')).toBe('"Core"');
    expect(daxLiteral(2024)).toBe('2024');
    expect(daxLiteral(-0.5)).toBe('-0.5');
    expect(daxLiteral(1e21)).toBe('1000000000000000000000');
    expect(daxLiteral(false)).toBe('FALSE()');
    expect(() => daxLiteral(Number.NaN)).toThrow();
  });

  it('applies one or several values of a column', () => {
    expect(treatAs('Core', "'g'[G]")).toBe(`TREATAS({"Core"}, 'g'[G])`);
    expect(treatAs(['Core', 'Transport'], "'g'[G]")).toBe(`TREATAS({"Core", "Transport"}, 'g'[G])`);
    expect(treatAs([2023, 2024], "'d'[Year]")).toBe(`TREATAS({2023, 2024}, 'd'[Year])`);
    expect(() => treatAs([], "'g'[G]")).toThrow();
  });
});

describe('buildKpiQuery', () => {
  it('queries the whole register when no cross-filter is active', () => {
    expect(buildKpiQuery({ group: null, className: null })).toBe(
      [
        'EVALUATE',
        'SUMMARIZECOLUMNS(',
        '  "TotalAssets", [Asset Count (All States)],',
        '  "TotalAssessed", [Assets Assessed For Condition],',
        '  "DueForRenewal", [Assets Due For Renewal],',
        '  "AvgBaseLife", [Avg Base Life (Years)],',
        '  "PctAssessed", [% Assessed For Condition]',
        ')',
      ].join('\n')
    );
  });

  it('applies group and class filters before the measures', () => {
    const dax = buildKpiQuery({ group: 'Utility_Line', className: 'Water_Pipes' });
    const lines = dax.split('\n');
    expect(lines[2]).toBe(`  TREATAS({"Utility_Line"}, 'asset_class_group'[Asset_Class_Group]),`);
    expect(lines[3]).toBe(`  TREATAS({"Water_Pipes"}, 'asset_class'[Asset_Class]),`);
    expect(lines[4]).toContain('"TotalAssets"');
  });
});

describe('buildGroupsQuery', () => {
  it('groups by Asset_Class_Group without filters by default', () => {
    const dax = buildGroupsQuery({ className: null });
    expect(dax).toContain(`SUMMARIZECOLUMNS(\n  'asset_class_group'[Asset_Class_Group],\n  "AssetCount"`);
    expect(dax).not.toContain('TREATAS');
  });

  it('is narrowed by the class cross-filter only', () => {
    const dax = buildGroupsQuery({ className: 'Water_Pipes' });
    expect(dax).toContain(`TREATAS({"Water_Pipes"}, 'asset_class'[Asset_Class])`);
    expect(dax).not.toContain("'asset_class_group'[Asset_Class_Group])");
  });
});

describe('buildClassesQuery', () => {
  it('returns the top classes by inventory', () => {
    const dax = buildClassesQuery({ group: null, search: '', kpiFocus: 'all' });
    expect(dax).toBe(
      [
        'EVALUATE',
        'TOPN(',
        `  ${CLASS_LIMIT},`,
        '  SUMMARIZECOLUMNS(',
        "    'asset_class'[Asset_Class],",
        '    "AssetCount", [Asset Count (All States)],',
        '    "Assessed", [Assets Assessed For Condition],',
        '    "DueForRenewal", [Assets Due For Renewal]',
        '  ),',
        '  [AssetCount],',
        '  DESC',
        ')',
      ].join('\n')
    );
  });

  it('searches and focuses in the engine before TOPN truncates', () => {
    const dax = buildClassesQuery({ group: 'Utility_Line', search: '  pipe ', kpiFocus: 'renewal' });
    expect(dax).toBe(
      [
        'EVALUATE',
        'TOPN(',
        `  ${CLASS_LIMIT},`,
        '  FILTER(',
        '    SUMMARIZECOLUMNS(',
        "      'asset_class'[Asset_Class],",
        `      TREATAS({"Utility_Line"}, 'asset_class_group'[Asset_Class_Group]),`,
        `      FILTER(VALUES('asset_class'[Asset_Class]), CONTAINSSTRING('asset_class'[Asset_Class], "pipe")),`,
        '      "AssetCount", [Asset Count (All States)],',
        '      "Assessed", [Assets Assessed For Condition],',
        '      "DueForRenewal", [Assets Due For Renewal]',
        '    ),',
        '    [DueForRenewal] > 0',
        '  ),',
        '  [AssetCount],',
        '  DESC',
        ')',
      ].join('\n')
    );
  });

  it('uses the assessed condition for the assessed focus', () => {
    expect(buildClassesQuery({ group: null, search: '', kpiFocus: 'assessed' })).toContain('    [Assessed] > 0\n');
  });

  it('ignores a whitespace-only search', () => {
    expect(buildClassesQuery({ group: null, search: '   ', kpiFocus: 'all' })).not.toContain('CONTAINSSTRING');
  });

  it('escapes the search term', () => {
    expect(buildClassesQuery({ group: null, search: 'a"b', kpiFocus: 'all' })).toContain(
      `CONTAINSSTRING('asset_class'[Asset_Class], "a""b")`
    );
  });
});
