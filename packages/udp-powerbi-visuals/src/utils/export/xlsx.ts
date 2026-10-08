import { exportValue, type TableColumn, type TableRow } from '../table/model';

/** Excel forbids \ / ? * [ ] : in sheet names and caps them at 31 characters. */
export function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Data';
}

/**
 * .xlsx bytes for the export. SheetJS (official 0.20.x build from cdn.sheetjs.com) is loaded on
 * demand, so it costs nothing until someone exports. Text cells are written as text, never as
 * formulas, so a value like "=1+1" cannot execute.
 */
export async function toXlsx(columns: readonly TableColumn[], rows: readonly TableRow[], name: string): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const aoa = [columns.map((c) => c.label), ...rows.map((row) => columns.map((c) => exportValue(row, c)))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName(name));
  return XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
}
