import { describe, expect, it } from 'vitest';
import {
  cellText,
  columnsFromRows,
  exportValue,
  labelFromKey,
  nextSort,
  paginate,
  sortRows,
  type TableColumn,
  type TableRow,
} from './model';

const NAME: TableColumn = { key: 'name', label: 'Name' };
const COUNT: TableColumn = { key: 'count', label: 'Count', kind: 'number' };
const COLUMNS = [NAME, COUNT];

const rows: TableRow[] = [
  { name: 'Valves', count: 1000 },
  { name: 'bridges', count: 500 },
  { name: 'Hydrants', count: 1000 },
  { name: 'Roads', count: null },
  { name: 'Water_Pipes', count: '1979' },
];

describe('table model', () => {
  it('labels executeQueries keys by their column or measure name', () => {
    expect(labelFromKey("'asset_class'[Asset_Class]")).toBe('Asset Class');
    expect(labelFromKey('asset_class_group[Asset_Class_Group]')).toBe('Asset Class Group');
    expect(labelFromKey('[Assets Due For Renewal]')).toBe('Assets Due For Renewal');
    expect(labelFromKey('plain')).toBe('plain');
  });

  it('infers numeric columns from the raw rows', () => {
    expect(columnsFromRows([{ 'a[Name]': 'x', '[Count]': 3 }, { 'a[Name]': 'y', '[Count]': null }])).toEqual([
      { key: 'a[Name]', label: 'Name', kind: 'text' },
      { key: '[Count]', label: 'Count', kind: 'number' },
    ]);
  });

  it('sorts numbers high → low with a stable order for ties and missing values last', () => {
    const sorted = sortRows(rows, { key: 'count', dir: 'desc' }, COLUMNS).map((r) => r.name);
    expect(sorted).toEqual(['Water_Pipes', 'Valves', 'Hydrants', 'bridges', 'Roads']);
    const asc = sortRows(rows, { key: 'count', dir: 'asc' }, COLUMNS).map((r) => r.name);
    expect(asc).toEqual(['bridges', 'Valves', 'Hydrants', 'Water_Pipes', 'Roads']);
  });

  it('sorts text case-insensitively', () => {
    expect(sortRows(rows, { key: 'name', dir: 'asc' }, COLUMNS).map((r) => r.name)).toEqual([
      'bridges',
      'Hydrants',
      'Roads',
      'Valves',
      'Water_Pipes',
    ]);
  });

  it('cycles the sort: numbers start descending, a second click flips', () => {
    expect(nextSort(null, COUNT)).toEqual({ key: 'count', dir: 'desc' });
    expect(nextSort(null, NAME)).toEqual({ key: 'name', dir: 'asc' });
    expect(nextSort({ key: 'count', dir: 'desc' }, COUNT)).toEqual({ key: 'count', dir: 'asc' });
  });

  it('paginates and clamps the page', () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ i }));
    expect(paginate(many, 0, 10)).toMatchObject({ page: 0, pageCount: 3, first: 1, last: 10, total: 23 });
    expect(paginate(many, 2, 10).rows).toHaveLength(3);
    expect(paginate(many, 9, 10)).toMatchObject({ page: 2, first: 21, last: 23 });
    expect(paginate([], 0, 10)).toMatchObject({ page: 0, pageCount: 1, first: 0, last: 0 });
  });

  it('formats cells for display and keeps raw values for export', () => {
    expect(cellText({ count: 1979 }, COUNT)).toBe('1,979');
    expect(cellText({ count: null }, COUNT)).toBe('—');
    expect(cellText({ share: 0.545 }, { key: 'share', label: 'Share', kind: 'number', format: { style: 'percent' } })).toBe('54.5%');
    expect(exportValue({ count: '1979' }, COUNT)).toBe(1979);
    expect(exportValue({ name: 7 }, NAME)).toBe(7);
    expect(exportValue({ name: undefined }, NAME)).toBeNull();
  });
});
