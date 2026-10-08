import { timeDay, timeMonday, timeMonth, timeSunday } from 'd3-time';
import type { TooltipItem } from '../events';

/**
 * Calendar heatmap (FT "change over time" at day grain): one column per week, one row per weekday,
 * from the first day of the first month to the last day of the last month. A day without a value
 * is "no data", never the lowest class.
 */

export interface CalendarDay {
  /** ISO date (YYYY-MM-DD or a full timestamp). */
  date: string;
  value: number | null;
  /** The raw value a click reports (default: the ISO date). */
  raw?: string | number;
  tooltips?: TooltipItem[];
}

export interface CalendarCell {
  /** YYYY-MM-DD */
  iso: string;
  date: Date;
  week: number;
  /** 0 = first day of the week (Monday by default). */
  weekday: number;
  value: number | null;
  day?: CalendarDay;
}

export interface CalendarLayout {
  cells: CalendarCell[];
  weeks: number;
  /** Month labels at the column of the month's first full week. */
  months: Array<{ label: string; week: number }>;
}

/** YYYY-MM-DD of a local date. */
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A local date from YYYY-MM-DD[THH…] (no time-zone shift). */
export function parseDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTH = new Intl.DateTimeFormat('en', { month: 'short' });

export function calendarLayout(days: readonly CalendarDay[], { weekStart = 'monday' }: { weekStart?: 'monday' | 'sunday' } = {}): CalendarLayout {
  const byIso = new Map<string, CalendarDay>();
  for (const d of days) {
    const date = parseDay(d.date);
    if (date) byIso.set(isoDay(date), d);
  }
  const dates = [...byIso.keys()].sort();
  if (!dates.length) return { cells: [], weeks: 0, months: [] };
  const first = timeMonth.floor(parseDay(dates[0] as string) as Date);
  const last = timeDay.offset(timeMonth.ceil(timeDay.offset(parseDay(dates[dates.length - 1] as string) as Date, 1)), -1);
  const week = weekStart === 'monday' ? timeMonday : timeSunday;
  const origin = week.floor(first);
  const cells = timeDay.range(first, timeDay.offset(last, 1)).map((date) => {
    const iso = isoDay(date);
    const day = byIso.get(iso);
    return {
      iso,
      date,
      week: week.count(origin, date),
      weekday: (date.getDay() + (weekStart === 'monday' ? 6 : 0)) % 7,
      value: day && typeof day.value === 'number' && Number.isFinite(day.value) ? day.value : null,
      day,
    };
  });
  const months = timeMonth.range(first, timeDay.offset(last, 1)).map((m) => ({ label: MONTH.format(m), week: week.count(origin, week.ceil(m)) }));
  return { cells, weeks: (cells[cells.length - 1]?.week ?? 0) + 1, months };
}
