import { describe, expect, it } from 'vitest';
import { heatScales, initialExpanded, matrixTable, maxDepth, visibleRows, type MatrixMeasure, type MatrixNode } from './matrix';

const leaf = (id: string, assets: number, share: number | null): MatrixNode => ({ id, label: id, cells: { assets: [assets], share: [share] } });
// Subtotals as the engine returns them (the share is NOT the mean of the children: 0.5 here)
const tree: MatrixNode[] = [
  { id: 'Core', label: 'Core', cells: { assets: [30], share: [0.5] }, children: [leaf('Buildings', 10, 0.9), leaf('Bridges', 20, 0.3)] },
  { id: 'Transport', label: 'Transport', cells: { assets: [5], share: [0.8] }, children: [leaf('Roads', 5, 0.8)] },
];
const measures: MatrixMeasure[] = [
  { id: 'assets', label: 'Assets', heatmap: 'sequential' },
  { id: 'share', label: 'Assessed', heatmap: 'diverging', center: 0.8, format: { style: 'percent' } },
];

describe('matrix layout', () => {
  it('opens levels on demand and lists the visible rows depth-first', () => {
    expect(maxDepth(tree)).toBe(1);
    expect(initialExpanded(tree, 0).size).toBe(0);
    expect([...initialExpanded(tree, 1)]).toEqual(['Core', 'Transport']);
    const rows = visibleRows(tree, new Set(['Core']));
    expect(rows.map((r) => [r.path, r.depth, r.expanded])).toEqual([
      ['Core', 0, true],
      ['Core/Buildings', 1, false],
      ['Core/Bridges', 1, false],
      ['Transport', 0, false],
    ]);
    expect(rows[1]?.parent).toBe('Core');
  });

  it('heat-maps the deepest rows only, with token ramps (diverging by business meaning)', () => {
    const heat = heatScales(tree, measures);
    expect(heat.get('assets')?.(20)).toEqual({ fill: 'var(--pbi-seq-7)', text: 'var(--pbi-seq-text-7)' });
    expect(heat.get('assets')?.(5)).toEqual({ fill: 'var(--pbi-seq-1)', text: 'var(--pbi-seq-text-1)' });
    expect(heat.get('assets')?.(null)).toBeNull();
    // 0.8 is the reference: neutral; 0.3 is the farthest below it: the unfavourable end
    expect(heat.get('share')?.(0.8)?.fill).toBe('var(--pbi-div-4)');
    expect(heat.get('share')?.(0.3)?.fill).toBe('var(--pbi-div-1)');
    expect(heatScales(tree, [{ id: 'assets', label: 'Assets' }]).size).toBe(0);
  });

  it('flattens the hierarchy for the export, subtotals included as the engine sent them', () => {
    const m = matrixTable(tree, [], measures, { rowLevels: ['Group', 'Class'], grandTotal: { id: 't', label: 'Total', cells: { assets: [35], share: [0.55] } } });
    expect(m.columns.map((c) => c.label)).toEqual(['Group', 'Class', 'Assets', 'Assessed']);
    expect(m.rows.map((r) => [r.l0, r.l1, r['m:share']])).toEqual([
      ['Core', null, 0.5],
      ['Core', 'Buildings', 0.9],
      ['Core', 'Bridges', 0.3],
      ['Transport', null, 0.8],
      ['Transport', 'Roads', 0.8],
      ['Total', null, 0.55],
    ]);
  });

  it('pivots a column dimension with engine totals', () => {
    const pivot: MatrixNode[] = [{ id: 'C5', label: 'C5', cells: { assets: [3, 4] }, total: { assets: 7 } }];
    const m = matrixTable(pivot, [{ id: '1', label: 'Good' }, { id: '2', label: 'Poor' }], [{ id: 'assets', label: 'Assets' }], { rowLevels: ['Criticality'] });
    expect(m.columns.map((c) => c.label)).toEqual(['Criticality', 'Good', 'Poor', 'Total']);
    expect(m.rows[0]).toMatchObject({ l0: 'C5', 'c:1|assets': 3, 'c:2|assets': 4, 't:assets': 7 });
  });
});
