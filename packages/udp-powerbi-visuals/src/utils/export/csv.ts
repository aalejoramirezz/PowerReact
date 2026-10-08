import { exportValue, type TableColumn, type TableRow } from '../table/model';

/**
 * RFC 4180 CSV for the client-side export: CRLF line breaks, fields quoted when they contain the
 * delimiter, a quote or a line break, embedded quotes doubled. A UTF-8 BOM makes Excel read accents.
 */

const BOM = '﻿';

/**
 * CSV injection guard (OWASP): text starting with = + - @ (or a tab / carriage return) would run as
 * a formula when the file is opened in a spreadsheet, so it is prefixed with an apostrophe.
 * Real numbers are written as numbers and never guarded (a negative value stays negative).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | boolean | null, delimiter = ','): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  const needsQuotes = text.includes(delimiter) || /["\r\n]/.test(text) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
  { bom = true, delimiter = ',' }: { bom?: boolean; delimiter?: string } = {}
): string {
  const header = columns.map((c) => csvCell(c.label, delimiter)).join(delimiter);
  const lines = rows.map((row) => columns.map((c) => csvCell(exportValue(row, c), delimiter)).join(delimiter));
  return `${bom ? BOM : ''}${[header, ...lines].join('\r\n')}\r\n`;
}
