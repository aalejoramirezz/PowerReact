import { useEffect, useState } from 'react';
import { cx, stagger } from '../ui/cx';
import { donutLayout, type DonutDatum } from './layout/donut';
import { formatInteger, formatPercent } from './layout/format';

interface DonutProps<T extends DonutDatum> {
  data: readonly T[];
  label: string;
  /** Unit under the centre number, e.g. "requests". */
  centerLabel?: string;
  formatValue?: (value: number) => string;
  /** Diameter in px. */
  size?: number;
  selectedId?: string | null;
  onSelect?: (datum: T) => void;
}

/**
 * Donut for simple composition (principle 17; Lens native donut / dark mockup): total in the hole,
 * legend list on the right with share and value, largest part first in the strongest colour.
 * More than six parts is a ranking: the tail folds into "Other" and a dev warning is logged.
 */
export function Donut<T extends DonutDatum>({
  data,
  label,
  centerLabel = 'total',
  formatValue = formatInteger,
  size = 164,
  selectedId = null,
  onSelect,
}: DonutProps<T>) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const stroke = Math.round(size * 0.13);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const layout = donutLayout(data, r);

  useEffect(() => {
    if (import.meta.env.DEV && layout.collapsed > 0) {
      console.warn(`[Donut] "${label}": ${layout.collapsed} categories folded into "Other". A composition with more than six parts is a ranking (SpotlightBars).`);
    }
  }, [label, layout.collapsed]);

  const focusId = hoverId ?? selectedId;
  const focused = layout.segments.find((s) => s.id === focusId);
  const byId = new Map(data.map((d) => [d.id, d]));

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--u-track)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${c} ${c})`}>
          {layout.segments.map((s, i) => (
            <circle
              key={s.id}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={`var(--u-series-${s.slot})`}
              strokeWidth={stroke}
              strokeDasharray={`${s.length} ${layout.circumference}`}
              strokeDashoffset={s.offset}
              style={{
                opacity: focusId && focusId !== s.id ? 0.35 : 1,
                transition: 'opacity .2s',
                animation: `u-seg 1.2s var(--u-ease) ${0.2 + i * 0.15}s both`,
              }}
            />
          ))}
        </g>
        <text x={c} y={c + 4} textAnchor="middle" className="u-num" style={{ font: '600 26px var(--u-font-display)', fill: 'var(--u-title)', letterSpacing: '-0.02em' }}>
          {formatValue(focused ? focused.value : layout.total)}
        </text>
        <text x={c} y={c + 24} textAnchor="middle" style={{ font: '500 11px var(--u-font-body)', fill: 'var(--u-label)' }}>
          {focused ? formatPercent(focused.share, 0) : centerLabel}
        </text>
      </svg>

      <ul className="min-w-[180px] flex-1" aria-label={`${label} legend`}>
        {layout.segments.map((s, k) => {
          const datum = byId.get(s.id);
          const content = (
            <>
              <span className="flex min-w-0 items-center gap-2.5 text-u-text-soft">
                <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--u-series-${s.slot})` }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="u-num text-right text-u-label">{formatPercent(s.share, 0)}</span>
              <b className="u-num text-right text-[14px] font-semibold text-u-title">{formatValue(s.value)}</b>
            </>
          );
          const rowClass = cx(
            'grid w-full grid-cols-[minmax(0,1fr)_auto_52px] items-center gap-3 border-b border-u-grid py-2.5 text-left text-[12.5px] transition-opacity',
            focusId && focusId !== s.id && 'opacity-45'
          );
          return (
            <li
              key={s.id}
              style={{ ...stagger('--k', k), animation: 'u-fade .5s var(--u-ease) calc(var(--k) * 80ms + 400ms) both' }}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {onSelect && datum ? (
                <button type="button" className={cx(rowClass, 'cursor-pointer')} aria-pressed={selectedId === s.id} onClick={() => onSelect(datum)}>
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
        {layout.collapsed > 0 && (
          <li className="pt-2 text-[11px] text-u-label">
            {layout.collapsed} smaller categories grouped as “Other”. With more than six parts, use a ranking.
          </li>
        )}
      </ul>
    </div>
  );
}
