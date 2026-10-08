import type { Categorised } from '../data';
import type { TooltipItem } from '../events';
import type { ChipTone } from '../table/model';
import { parseDay } from './calendar';

/**
 * Timeline (Priestley / Gantt, FT "change over time"): items with a start and an end on a time
 * axis, grouped in lanes and packed into rows so overlapping items never collide; a "today" line
 * puts them in context (what is running, what ends soon).
 */

export interface TimelineTask extends Categorised {
  id: string;
  label: string;
  /** ISO dates; an open end runs to the end of the axis. */
  start: string;
  end: string | null;
  lane?: string;
  /** Tone by meaning (e.g. expiring = warn, expired = bad); neutral by default. */
  tone?: ChipTone | 'neutral';
  tooltips?: TooltipItem[];
}

export interface TimelineBar {
  task: TimelineTask;
  start: Date;
  end: Date;
  /** Open end (no end date). */
  open: boolean;
  /** Row inside its lane. */
  row: number;
}

export interface TimelineLane {
  lane: string;
  rows: number;
  bars: TimelineBar[];
}

const DAY = 86_400_000;

/**
 * Lanes in first-appearance order, bars sorted by start and packed greedily into the first row
 * whose last bar has ended; the domain spans every bar and `today` (when given).
 */
export function timelineLayout(tasks: readonly TimelineTask[], { today }: { today?: Date | null } = {}): { lanes: TimelineLane[]; domain: [Date, Date] | null } {
  const parsed = tasks
    .map((task) => ({ task, start: parseDay(task.start), end: task.end ? parseDay(task.end) : null }))
    .filter((t): t is { task: TimelineTask; start: Date; end: Date | null } => t.start !== null);
  if (!parsed.length) return { lanes: [], domain: null };
  const times = parsed.flatMap((t) => [t.start.getTime(), ...(t.end ? [t.end.getTime()] : [])]);
  if (today) times.push(today.getTime());
  let lo = Math.min(...times);
  let hi = Math.max(...times);
  if (hi - lo < 30 * DAY) {
    lo -= 15 * DAY;
    hi += 15 * DAY;
  }
  const domain: [Date, Date] = [new Date(lo), new Date(hi)];

  const lanes = new Map<string, TimelineLane>();
  for (const t of [...parsed].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const key = t.task.lane ?? '';
    let lane = lanes.get(key);
    if (!lane) {
      lane = { lane: key, rows: 0, bars: [] };
      lanes.set(key, lane);
    }
    const end = t.end && t.end >= t.start ? t.end : t.end ? t.start : domain[1];
    const rowEnds: number[] = [];
    for (const b of lane.bars) rowEnds[b.row] = Math.max(rowEnds[b.row] ?? -Infinity, b.end.getTime());
    let row = rowEnds.findIndex((e) => e < t.start.getTime());
    if (row < 0) row = rowEnds.length;
    lane.bars.push({ task: t.task, start: t.start, end, open: !t.end, row });
    lane.rows = Math.max(lane.rows, row + 1);
  }
  // Keep the lanes in the order the tasks named them
  const order = [...new Set(tasks.map((t) => t.lane ?? ''))];
  return { lanes: order.map((l) => lanes.get(l)).filter((l): l is TimelineLane => Boolean(l)), domain };
}
