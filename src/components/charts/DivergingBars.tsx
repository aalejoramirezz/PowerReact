import { stagger } from '../ui/cx';
import { divergingRows, type BarDatum } from './layout/bars';
import { formatInteger, formatSigned } from './layout/format';

interface DivergingBarsProps<T extends BarDatum> {
  data: readonly T[];
  label: string;
  negativeLabel?: string;
  positiveLabel?: string;
  /** Max rows; with more members the strongest ends of both sides are kept. */
  maxRows?: number;
  formatValue?: (value: number) => string;
}

/**
 * Diverging bars (Lens `diverging_bars`): signed values around a centre axis, most negative first.
 * Direction is carried by side, sign and the end labels — never by colour alone.
 */
export function DivergingBars<T extends BarDatum>({
  data,
  label,
  negativeLabel = 'Negative',
  positiveLabel = 'Positive',
  maxRows = 16,
  formatValue = formatInteger,
}: DivergingBarsProps<T>) {
  const rows = divergingRows(data, maxRows);
  const grid = 'grid grid-cols-[minmax(72px,26%)_1fr_1fr_64px] items-center gap-x-2.5';

  return (
    <div aria-label={label} role="group">
      <div className={`${grid} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-u-subtitle`}>
        <span />
        <span className="text-left">← {negativeLabel}</span>
        <span className="text-right">{positiveLabel} →</span>
        <span />
      </div>
      <ul className="flex flex-col">
        {rows.map((row, k) => (
          <li
            key={row.datum.id}
            className={`${grid} h-[28px]`}
            style={{ ...stagger('--k', k), animation: 'u-fade .5s var(--u-ease) calc(var(--k) * 45ms + 200ms) both' }}
          >
            <span className="truncate text-[12px] font-medium text-u-label">{row.datum.label}</span>
            <span className="flex h-2 justify-end rounded-l-full bg-u-track">
              {row.side === 'negative' && (
                <i
                  className="block h-full rounded-l-full bg-u-secondary"
                  style={{ width: `${row.ratio * 100}%`, transformOrigin: 'right', animation: 'u-grow .9s var(--u-ease) calc(var(--k) * 50ms + 300ms) both' }}
                />
              )}
            </span>
            <span className="flex h-2 rounded-r-full bg-u-track">
              {row.side === 'positive' && (
                <i
                  className="block h-full rounded-r-full"
                  style={{
                    width: `${row.ratio * 100}%`,
                    background: 'linear-gradient(90deg, var(--u-bar-1), var(--u-bar-2))',
                    transformOrigin: 'left',
                    animation: 'u-grow .9s var(--u-ease) calc(var(--k) * 50ms + 300ms) both',
                  }}
                />
              )}
            </span>
            <span className="u-num text-right text-[12.5px] font-semibold text-u-title">{formatSigned(row.datum.value, formatValue)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
