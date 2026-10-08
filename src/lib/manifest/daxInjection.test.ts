import { describe, expect, it } from 'vitest';
import { countTopLevelEvaluate, injectCrossFilters, parseColumnRef, sameColumn, splitDaxQuery } from './daxInjection';

const GROUP = "'asset_class_group'[Asset_Class_Group]";
const BASE = `EVALUATE
SUMMARIZECOLUMNS('asset_class'[Asset_Class], "Assets", [Asset Count (All States)])`;

describe('splitDaxQuery', () => {
  it('finds DEFINE, the table expression and ORDER BY at the top level', () => {
    const dax = `DEFINE
  VAR _limit = 10
  MEASURE 'x'[m] = 1
EVALUATE
  TOPN(_limit, VALUES('t'[c]))
ORDER BY 't'[c] ASC`;
    expect(splitDaxQuery(dax)).toEqual({
      define: "DEFINE\n  VAR _limit = 10\n  MEASURE 'x'[m] = 1\n",
      table: "TOPN(_limit, VALUES('t'[c]))",
      tail: "ORDER BY 't'[c] ASC",
    });
  });

  it('ignores keywords inside strings, quoted names, brackets and comments', () => {
    const dax = `// EVALUATE in a comment
/* EVALUATE again */
EVALUATE ROW("EVALUATE", 1, "x", [Order By], "y", 'EVALUATE table'[c]) -- ORDER BY nothing`;
    expect(countTopLevelEvaluate(dax)).toBe(1);
    expect(splitDaxQuery(dax).tail).toBe('');
  });

  it('is case-insensitive and does not match inside identifiers', () => {
    expect(countTopLevelEvaluate('evaluate ROW("a", 1)')).toBe(1);
    expect(countTopLevelEvaluate('EVALUATE ROW("a", REEVALUATE_ME)')).toBe(1);
    expect(countTopLevelEvaluate('EVALUATE ROW("a", 1) EVALUATE ROW("b", 2)')).toBe(2);
    expect(() => splitDaxQuery('ROW("a", 1)')).toThrow(/exactly one/);
  });
});

describe('injectCrossFilters', () => {
  it('is the identity without filters (same text, same cache entry)', () => {
    expect(injectCrossFilters(BASE, [])).toBe(BASE);
  });

  it('wraps the table expression in CALCULATETABLE + TREATAS', () => {
    expect(injectCrossFilters(BASE, [{ field: GROUP, values: ['Utility_Line'] }])).toBe(`EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS('asset_class'[Asset_Class], "Assets", [Asset Count (All States)]),
  TREATAS({"Utility_Line"}, 'asset_class_group'[Asset_Class_Group])
)`);
  });

  it('keeps DEFINE / VAR blocks and the ORDER BY clause', () => {
    const dax = `DEFINE VAR _n = 5
EVALUATE TOPN(_n, VALUES('t'[c]))
ORDER BY 't'[c]`;
    const out = injectCrossFilters(dax, [{ field: "'t'[g]", values: ['A'] }]);
    expect(out.startsWith('DEFINE VAR _n = 5\nEVALUATE\nCALCULATETABLE(')).toBe(true);
    expect(out).toContain("TREATAS({\"A\"}, 't'[g])");
    expect(out.endsWith("\nORDER BY 't'[c]")).toBe(true);
  });

  it('escapes quotes in values (no injection through a clicked label)', () => {
    const out = injectCrossFilters(BASE, [{ field: "'p'[Name]", values: ['O"Brien"), ALL(\'p\''] }]);
    expect(out).toContain(`TREATAS({"O""Brien""), ALL('p'"}, 'p'[Name])`);
    expect(out.match(/TREATAS/g)).toHaveLength(1);
  });

  it('writes numbers and booleans as typed literals', () => {
    expect(injectCrossFilters(BASE, [{ field: "'d'[Year]", values: [2024] }])).toContain("TREATAS({2024}, 'd'[Year])");
    expect(injectCrossFilters(BASE, [{ field: "'d'[Rate]", values: [0.125] }])).toContain("TREATAS({0.125}, 'd'[Rate])");
    expect(injectCrossFilters(BASE, [{ field: "'a'[Active]", values: [true] }])).toContain("TREATAS({TRUE()}, 'a'[Active])");
  });

  it('writes one TREATAS per filter: values listed together, filters on one column intersected', () => {
    const out = injectCrossFilters(BASE, [
      { field: GROUP, values: ['Core', 'Transport', 'Core'] },
      { field: "'asset_class'[Asset_Class]", values: ['Buildings'] },
      { field: 'asset_class_group[Asset_Class_Group]', values: ['Transport'] },
    ]);
    expect(out).toContain(`TREATAS({"Core", "Transport"}, ${GROUP})`);
    expect(out).toContain(`TREATAS({"Transport"}, ${GROUP})`);
    expect(out).toContain(`TREATAS({"Buildings"}, 'asset_class'[Asset_Class])`);
    expect(out.match(/TREATAS/g)).toHaveLength(3);
  });

  it('writes identical filters once and skips empty ones', () => {
    const out = injectCrossFilters(BASE, [
      { field: GROUP, values: ['Core'] },
      { field: 'asset_class_group[Asset_Class_Group]', values: ['Core'] },
    ]);
    expect(out.match(/TREATAS/g)).toHaveLength(1);
    expect(injectCrossFilters(BASE, [{ field: GROUP, values: [] }])).toBe(BASE);
  });

  it('rejects a filter on something that is not a column reference', () => {
    expect(() => injectCrossFilters(BASE, [{ field: 'ALL(x)', values: ['a'] }])).toThrow(/column reference/);
    expect(() => injectCrossFilters(BASE, [{ field: "'t'[c]) , ('x", values: ['a'] }])).toThrow(/column reference/);
  });
});

describe('column references', () => {
  it('normalises quoting', () => {
    expect(parseColumnRef('asset_class[Asset_Class]')).toBe("'asset_class'[Asset_Class]");
    expect(parseColumnRef("'Date Table'[Month]")).toBe("'Date Table'[Month]");
    expect(parseColumnRef("'O''Neil'[x]")).toBe("'O''Neil'[x]");
    expect(sameColumn(GROUP, 'asset_class_group[Asset_Class_Group]')).toBe(true);
    expect(sameColumn(GROUP, "'asset_class'[Asset_Class]")).toBe(false);
  });
});
