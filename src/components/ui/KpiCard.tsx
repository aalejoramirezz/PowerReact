import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx, stagger } from './cx';
import { InfoCurtain, type CurtainContent } from './InfoCurtain';

interface KpiCardProps extends CurtainContent {
  label: string;
  icon?: LucideIcon;
  /** Already formatted value, or a placeholder while loading / on error. */
  value: string;
  /** Delta, unit or badge next to the value. */
  aside?: React.ReactNode;
  /** Quiet context under the value (e.g. a meter). */
  footer?: React.ReactNode;
  active?: boolean;
  /** Previous filters' data shown while the new query runs. */
  stale?: boolean;
  onClick?: () => void;
  title?: string;
  index?: number;
}

const kpiTestId = (label: string) => `kpi-${label.toLowerCase().replace(/\s+/g, '-')}`;

/**
 * KPI card (Lens `kpi_card`): uppercase label, tinted icon mark, the number as the dominant element,
 * an optional delta. "What it means / how it is calculated" lives one hover (or keyboard focus) away
 * in the curtain (principle 35), never on the card face.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  icon: Icon,
  value,
  aside,
  footer,
  active = false,
  stale = false,
  onClick,
  title,
  index = 0,
  info,
  calc,
}) => {
  const curtainId = useId();
  const hasCurtain = Boolean(info || calc);
  const className = cx(
    'u-card u-curtain-host flex w-full flex-col justify-between text-left',
    onClick && 'u-card--interactive',
    active && 'u-card--active'
  );
  const style = { ...stagger('--i', index), padding: 'var(--u-kpi-pad)', minHeight: 112 };

  const content = (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <span className="truncate text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] text-u-label">
          {label}
        </span>
        {Icon && (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-u-mark-bg text-u-mark-fg"
            style={{ animation: 'u-fade .6s var(--u-ease) calc(var(--i,0) * 80ms + 250ms) both' }}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div className={cx('mt-3 flex items-end justify-between gap-3 transition-opacity', stale && 'opacity-50')}>
        <span
          className="u-num whitespace-nowrap text-[30px] font-semibold leading-none tracking-[-0.045em] text-u-title"
          style={{ animation: 'u-fade .8s var(--u-ease) calc(var(--i,0) * 80ms + 120ms) both' }}
          data-testid={kpiTestId(label)}
        >
          {value}
        </span>
        {aside && <span className="min-w-0 shrink">{aside}</span>}
      </div>
      {footer}
      {hasCurtain && <InfoCurtain id={curtainId} info={info} calc={calc} />}
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      title={title}
      aria-pressed={active}
      aria-describedby={hasCurtain ? curtainId : undefined}
    >
      {content}
    </button>
  ) : (
    // Focusable so keyboard users can reveal the curtain too
    <div
      className={className}
      style={style}
      title={title}
      tabIndex={hasCurtain ? 0 : undefined}
      aria-describedby={hasCurtain ? curtainId : undefined}
    >
      {content}
    </div>
  );
};

/** Delta text coloured by business meaning (favourable / unfavourable), never by sign alone. */
export const KpiDelta: React.FC<{ value: string; favourable: boolean }> = ({ value, favourable }) => (
  <span
    className={cx('whitespace-nowrap text-[12px] font-semibold', favourable ? 'text-u-delta-up' : 'text-u-delta-down')}
    style={{ animation: 'u-fade .6s var(--u-ease) calc(var(--i,0) * 80ms + 320ms) both' }}
  >
    {value}
  </span>
);
