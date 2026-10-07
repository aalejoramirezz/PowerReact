/**
 * The typed events every Univerus element emits. Elements are presentational: they never fetch,
 * build DAX or call endpoints; a click is reported and the container decides what it filters.
 */

/** A category value as it came from the semantic model (TREATAS needs the column's own type). */
export type DataPointValue = string | number | boolean;

export interface DataPointClickDetail {
  /** The `visual-id` of the element that was clicked (null when none was given). */
  visualId: string | null;
  /** Column reference the click filters, e.g. 'asset_class'[Asset_Class] (the `cross-filter-field` prop). */
  field: string | null;
  /** The clicked category's raw value. */
  value: DataPointValue | null;
  /** Its display label. */
  label: string;
}

export type ExportFormat = 'csv' | 'xlsx';

/** Informational: the file has already been generated and downloaded on the client. */
export interface ExportDetail {
  visualId: string | null;
  format: ExportFormat;
  fileName: string;
  rowCount: number;
}

export interface FocusModeDetail {
  visualId: string | null;
  open: boolean;
}

export type VisualView = 'chart' | 'table';

export interface ViewChangeDetail {
  visualId: string | null;
  view: VisualView;
}

/** Named themes; `data-theme` on the host pins one element to a template regardless of <html>. */
export type ThemeName = 'neoglass' | 'nocturne';

/** Same value? Raw values compare by text: a selection may come from a URL, a store or a click. */
export function sameValue(a: DataPointValue | null | undefined, b: DataPointValue | null | undefined): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
}
