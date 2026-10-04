import type React from 'react';
import { cx, stagger } from '../ui/cx';
import { StatusChip } from '../ui/primitives';
import { rankedRows, type BarDatum, type RankedRow } from './layout/bars';
import { formatInteger, formatPercent } from './layout/format';

export const BAR_FILL = 'linear-gradient(90deg, var(--u-bar-1), var(--u-bar-2) 60%, var(--u-bar-3))';

interface SpotlightBarsProps<T extends BarDatum> {
  data: readonly T[];
  /** Accessible name of the list. */
  label: string;
  formatValue?: (value: number) => string;
  /** Secondary figure beside the value. Default: share of the total of every category received. */
  secondary?: false | ((row: RankedRow<T>) => string);
  topN?: number;
  /** Prefix "#n" to each label. */
  rank?: boolean;
  selectedId?: string | null;
  /** Click cross-filters; rows become toggle buttons. */
  onSelect?: (datum: T) => void;
  /** Quiet line under the bar (supporting metrics). */
  renderMeta?: (datum: T) => React.ReactNode;
  /** Chip on the selected row, e.g. "Cross-Filtered". */
  selectedBadge?: string;
  /** data-testid prefix: `${p}-bar-${id}` on the row, `${p}-share-${id}` on the secondary figure. */
  testIdPrefix?: string;
}

const defaultSecondary = <T extends BarDatum>(row: RankedRow<T>) => formatPercent(row.share, 1);

/**
 * Spotlight bars (Lens `spotlight_bars`): the category above a slim pill bar on a full-width track,
 * the value at the end, its share of the total beside it and an optional rank. The answer to
 * "which category leads?" that can also filter the page; unselected rows recede when one is picked.
 */
export function SpotlightBars<T extends BarDatum>({
  data,
  label,
  formatValue = formatInteger,
  secondary = defaultSecondary,
  topN = 0,
  rank = false,
  selectedId = null,
  onSelect,
  renderMeta,
  selectedBadge,
  testIdPrefix,
}: SpotlightBarsProps<T>) {
  const { rows } = rankedRows(data, { topN });

  return (
    <ul className="flex flex-col gap-1" aria-label={label}>
      {rows.map((row) => {
        const { datum } = row;
        const isSelected = selectedId === datum.id;
        const isDimmed = selectedId !== null && !isSelected;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {rank && <span className="u-num text-[11px] font-semibold text-u-label">#{row.rank}</span>}
                <span className={cx('truncate text-[12.5px] text-u-title', isSelected ? 'font-bold' : 'font-semibold')}>
                  {datum.label}
                </span>
                {isSelected && selectedBadge && <StatusChip tone="accent">{selectedBadge}</StatusChip>}
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                {secondary && (
                  <span
                    className="u-num text-[11px] text-u-label"
                    data-testid={testIdPrefix ? `${testIdPrefix}-share-${datum.id}` : undefined}
                  >
                    {secondary(row)}
                  </span>
                )}
                <span className="u-num text-[14px] font-semibold text-u-title">{formatValue(datum.value)}</span>
              </span>
            </span>
            <span className="mt-2 block h-[7px] overflow-hidden rounded-full bg-u-track">
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
            {renderMeta && <span className="mt-1.5 block text-[11px] text-u-label">{renderMeta(datum)}</span>}
          </>
        );

        const rowClass = cx(
          'block w-full rounded-[10px] px-2.5 py-2 text-left transition-[opacity,background-color] duration-200',
          isDimmed && 'opacity-35 hover:opacity-100',
          isSelected && 'bg-u-row-selected'
        );

        return (
          <li key={datum.id} style={{ ...stagger('--k', row.rank - 1), animation: 'u-fade .5s var(--u-ease) calc(var(--i,0) * 80ms + var(--k) * 70ms + 200ms) both' }}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(datum)}
                aria-pressed={isSelected}
                data-testid={testIdPrefix ? `${testIdPrefix}-bar-${datum.id}` : undefined}
                className={cx(rowClass, 'cursor-pointer hover:bg-u-row-hover')}
              >
                {body}
              </button>
            ) : (
              <div className={rowClass} data-testid={testIdPrefix ? `${testIdPrefix}-bar-${datum.id}` : undefined}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
