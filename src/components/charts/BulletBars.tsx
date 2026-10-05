import { stagger } from '../ui/cx';
import { StatusChip } from '../ui/primitives';
import { bulletRows, type BulletDatum } from './layout/bars';
import { formatInteger, formatPercent, formatSigned } from './layout/format';
import { BAR_FILL } from './SpotlightBars';

interface BulletBarsProps<T extends BulletDatum> {
  data: readonly T[];
  label: string;
  /** 'above': at or over target is favourable (scores); 'below': under target is favourable (response time). */
  goodWhen?: 'above' | 'below';
  formatValue?: (value: number) => string;
  topN?: number;
  targetLabel?: string;
}

/**
 * Comparison (bullet) bars (Lens `bullet_bars`): fill = actual, tick = target on a shared scale,
 * and a variance chip coloured by whether the gap is good — never by its sign alone.
 */
export function BulletBars<T extends BulletDatum>({
  data,
  label,
  goodWhen = 'above',
  formatValue = formatInteger,
  topN = 8,
  targetLabel = 'Target',
}: BulletBarsProps<T>) {
  const rows = bulletRows(data, { goodWhen, topN });

  return (
    <ul className="flex flex-col" aria-label={label}>
      {rows.map((row, k) => (
        <li
          key={row.datum.id}
          className="grid h-[38px] grid-cols-[minmax(72px,22%)_1fr_auto_64px] items-center gap-3.5"
          style={{ ...stagger('--k', k), animation: 'u-fade .5s var(--u-ease) calc(var(--k) * 70ms + 200ms) both' }}
        >
          <span className="truncate text-[12.5px] font-medium text-u-label">{row.datum.label}</span>
          <span className="relative block h-2.5 rounded-full bg-u-track">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${row.actualRatio * 100}%`,
                background: BAR_FILL,
                transformOrigin: 'left',
                animation: 'u-grow 1.1s var(--u-ease) calc(var(--k) * 90ms + 300ms) both',
              }}
            />
            {row.targetRatio !== null && (
              <span
                className="absolute -bottom-[5px] -top-[5px] w-[2px] -translate-x-1/2 rounded-[1px] bg-u-title"
                style={{ left: `${row.targetRatio * 100}%`, animation: 'u-fade .4s var(--u-ease) calc(var(--k) * 90ms + 1s) both' }}
                title={`${targetLabel}: ${formatValue(row.datum.target ?? 0)}`}
              />
            )}
          </span>
          <span className="u-num min-w-[40px] text-right text-[13.5px] font-semibold text-u-title">{formatValue(row.datum.actual)}</span>
          <span className="text-right">
            {row.variance === null ? (
              <span className="text-[11px] text-u-label">—</span>
            ) : (
              <StatusChip tone={row.favourable ? 'ok' : 'bad'} className="u-num">
                {formatSigned(row.variance, (v) => formatPercent(v, 1))}
              </StatusChip>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
