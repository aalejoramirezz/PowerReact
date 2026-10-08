import { describe, expect, it } from 'vitest';
import type { TableColumn } from '../table/model';
import { csvCell, toCsv } from './csv';

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Asset Class' },
  { key: 'count', label: 'Count', kind: 'number' },
];

describe('CSV export', () => {
  it('writes a BOM, a header and CRLF rows with raw numbers', () => {
    const csv = toCsv(COLUMNS, [
      { name: 'Water_Pipes', count: 1979 },
      { name: 'Roads', count: null },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1)).toBe('Asset Class,Count\r\nWater_Pipes,1979\r\nRoads,\r\n');
  });

  it('quotes delimiters, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('O"Brien')).toBe('"O""Brien"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded ')).toBe('" padded "');
    expect(csvCell('a;b', ';')).toBe('"a;b"');
  });

  it.each(['=SUM(A1:A9)', '+1', '-1+2', '@cmd', '\tx'])('guards %j against formula injection', (text) => {
    expect(csvCell(text).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('keeps negative numbers, booleans and empty values intact', () => {
    expect(csvCell(-41)).toBe('-41');
    expect(csvCell(true)).toBe('TRUE');
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('can skip the BOM', () => {
    expect(toCsv(COLUMNS, [], { bom: false })).toBe('Asset Class,Count\r\n');
  });
});
