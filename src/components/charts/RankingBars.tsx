import { cx, stagger } from '../ui/cx';
import { rankedRows, type BarDatum } from './layout/bars';
import { formatInteger } from './layout/format';
import { BAR_FILL } from './SpotlightBars';

interface RankingBarsProps<T extends BarDatum> {
  data: readonly T[];
  label: string;
  formatValue?: (value: number) => string;
  topN?: number;
  /** 'asc' shows a bottom-N list; bar lengths stay relative to the overall leader. */
  order?: 'desc' | 'asc';
  selectedId?: string | null;
  onSelect?: (datum: T) => void;
}

/**
 * Compact ranking (Lens `ranking_bars`): name · quiet track with the gradient fill · value, one line
 * per category, sorted high → low. Use it when space is tight; SpotlightBars when shares matter.
 */
export function RankingBars<T extends BarDatum>({
  data,
  label,
  formatValue = formatInteger,
  topN = 8,
  order = 'desc',
  selectedId = null,
  onSelect,
}: RankingBarsProps<T>) {
  const { rows, hidden } = rankedRows(data, { topN, order });

  return (
    <div>
      <ul className="flex flex-col" aria-label={label}>
        {rows.map((row, k) => {
          const isSelected = selectedId === row.datum.id;
          const isDimmed = selectedId !== null && !isSelected;
          const content = (
            <>
              <span className="truncate text-[12.5px] font-medium text-u-label">{row.datum.label}</span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-u-track">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${row.ratio * 100}%`,
                    background: BAR_FILL,
                    boxShadow: 'var(--u-bar-glow)',
                    transformOrigin: 'left',
                    transition: 'width .5s var(--u-ease)',
                    animation: 'u-grow 1.1s var(--u-ease) calc(var(--i,0) * 80ms + var(--k) * 90ms + 300ms) both',
                  }}
                />
              </span>
              <span className="u-num text-right text-[13.5px] font-semibold text-u-title">{formatValue(row.datum.value)}</span>
            </>
          );
          const rowClass = cx(
            'grid h-[34px] w-full grid-cols-[minmax(72px,24%)_1fr_64px] items-center gap-4 rounded-md px-1 text-left transition-opacity',
            isDimmed && 'opacity-35 hover:opacity-100'
          );
          return (
            <li key={row.datum.id} style={{ ...stagger('--k', k), animation: 'u-fade .5s var(--u-ease) calc(var(--k) * 70ms + 200ms) both' }}>
              {onSelect ? (
                <button type="button" className={cx(rowClass, 'cursor-pointer hover:bg-u-row-hover')} aria-pressed={isSelected} onClick={() => onSelect(row.datum)}>
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <p className="mt-2 text-[11px] text-u-label">Top {rows.length} of {rows.length + hidden}</p>}
    </div>
  );
}
