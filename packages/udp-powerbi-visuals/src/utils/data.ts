import type { EventEmitter } from '@stencil/core';
import type { BarDatum, BulletDatum } from './layout/bars';
import type { DonutDatum } from './layout/donut';
import type { IbcsDatum } from './layout/ibcs';
import type { DataPointClickDetail, DataPointValue } from './events';
import type { ChipTone } from './table/model';

/**
 * Data shapes the elements accept. `id` keys the row and its test ids; `raw` is the category value
 * as the semantic model returned it (a click reports it, so TREATAS gets the column's own type).
 */
export interface Categorised {
  raw?: DataPointValue;
}

/** Quiet supporting line under a spotlight bar: "Assessed **1,840** (93%)". */
export interface BarMeta {
  label: string;
  value: string;
  note?: string;
  tone?: ChipTone;
}

export interface BarItem extends BarDatum, Categorised {
  meta?: BarMeta[];
}
export interface BulletItem extends BulletDatum, Categorised {}
export interface DonutItem extends DonutDatum, Categorised {}
export interface IbcsItem extends IbcsDatum, Categorised {}

/** The value a click on this category reports. */
export const clickValue = (d: { id: string } & Categorised): DataPointValue => d.raw ?? d.id;

/** The props every visual uses to report a click. */
export interface Clickable {
  visualId?: string;
  crossFilterField?: string;
  interactive?: boolean;
  dataPointClick: EventEmitter<DataPointClickDetail>;
}

/** Rows are buttons that report clicks when asked to, or when a cross-filter field is set. */
export const isInteractive = (c: Pick<Clickable, 'interactive' | 'crossFilterField'>): boolean =>
  c.interactive ?? Boolean(c.crossFilterField);

export function emitClick(c: Clickable, d: { id: string; label: string } & Categorised): void {
  c.dataPointClick.emit({ visualId: c.visualId ?? null, field: c.crossFilterField ?? null, value: clickValue(d), label: d.label });
}

/** Accessible name of a chart: its own label, else the card heading. */
export const chartLabel = (c: { label?: string; heading: string }): string => c.label || c.heading || 'Chart';

/** data-testid slug, e.g. "Due For Renewal" → "due-for-renewal". */
export const slug = (text: string): string => text.toLowerCase().replace(/\s+/g, '-');
