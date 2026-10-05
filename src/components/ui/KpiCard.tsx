import React, { useId, useState } from 'react';
import { Info, type LucideIcon } from 'lucide-react';
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
  /** Toggle state. Leave undefined for a plain action (no pressed state, no selection ring). */
  active?: boolean;
  /** Previous filters' data shown while the new query runs. */
  stale?: boolean;
  onClick?: () => void;
  title?: string;
  index?: number;
}

const slug = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

/**
 * KPI card (Lens `kpi_card`): uppercase label, tinted icon mark, the number as the dominant element,
 * an optional delta. "What it means / how it is calculated" lives one hover (or keyboard focus) away
 * in the curtain (principle 35), never on the card face.
 *
 * The card is a frame holding two siblings, never nested buttons: the content (a full-card button
 * when the KPI is clickable) and, on touch screens where hover does not exist, an ⓘ button in the
 * icon slot that toggles the same curtain.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  icon: Icon,
  value,
  aside,
  footer,
  active,
  stale = false,
  onClick,
  title,
  index = 0,
  info,
  calc,
}) => {
  const curtainId = useId();
  const [touchOpen, setTouchOpen] = useState(false);
  const hasCurtain = Boolean(info || calc);

  const content = (
    <>
      <div className={cx('flex items-start justify-between gap-2.5', hasCurtain && '@max-md:[@media(hover:none)]:pr-8')}>
        <span className="line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] text-u-label @md:truncate">
          {label}
        </span>
        {Icon && (
          <span
            className={cx(
              'hidden h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-u-mark-bg text-u-mark-fg @md:grid',
              hasCurtain && '[@media(hover:none)]:invisible'
            )}
            style={{ animation: 'u-fade .6s var(--u-ease) calc(var(--i,0) * 80ms + 250ms) both' }}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div className={cx('mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 transition-opacity', stale && 'opacity-50')}>
        <span
          className="u-num whitespace-nowrap text-[24px] font-semibold leading-none tracking-[-0.045em] text-u-title @md:text-[30px]"
          style={{ animation: 'u-fade .8s var(--u-ease) calc(var(--i,0) * 80ms + 120ms) both' }}
          data-testid={`kpi-${slug(label)}`}
        >
          {value}
        </span>
        {aside && <span className="min-w-0 shrink">{aside}</span>}
      </div>
      {footer}
    </>
  );

  const bodyClass = 'flex h-full w-full flex-col justify-between text-left focus-visible:outline-none';
  const bodyStyle = { padding: 'var(--u-kpi-pad)' };

  return (
    <div
      className={cx(
        'u-card u-curtain-host min-h-[112px]',
        onClick && 'u-card--interactive',
        active && 'u-card--active'
      )}
      style={stagger('--i', index)}
      data-testid={`kpi-card-${slug(label)}`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cx(bodyClass, 'cursor-pointer')}
          style={bodyStyle}
          title={title}
          aria-pressed={active}
          aria-describedby={hasCurtain ? curtainId : undefined}
        >
          {content}
        </button>
      ) : (
        // Focusable so keyboard users can reveal the curtain too
        <div
          className={bodyClass}
          style={bodyStyle}
          title={title}
          tabIndex={hasCurtain ? 0 : undefined}
          aria-describedby={hasCurtain ? curtainId : undefined}
        >
          {content}
        </div>
      )}

      {hasCurtain && (
        <>
          {/* Touch only: hover does not exist there, so the icon slot becomes an ⓘ toggle */}
          <button
            type="button"
            className="u-icon-btn absolute right-2 top-2 z-[6] hidden [@media(hover:none)]:inline-grid"
            aria-expanded={touchOpen}
            aria-controls={curtainId}
            aria-label={touchOpen ? `Hide what ${label} means` : `What ${label} means`}
            onClick={() => setTouchOpen(!touchOpen)}
          >
            <Info className="h-4 w-4" />
          </button>
          <InfoCurtain
            id={curtainId}
            info={info}
            calc={calc}
            open={touchOpen}
            onClose={() => setTouchOpen(false)}
            padding="var(--u-kpi-pad)"
          />
        </>
      )}
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
