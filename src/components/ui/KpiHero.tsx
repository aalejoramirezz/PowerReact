import React, { useId } from 'react';
import { cx, stagger } from './cx';
import { InfoCurtain, type CurtainContent } from './InfoCurtain';

interface KpiHeroProps extends CurtainContent {
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; favourable: boolean };
  /** Up to 4 supporting metrics (label, formatted value). */
  metrics?: Array<{ label: string; value: string }>;
  /** Optional utilisation meter, 0..1. */
  meter?: { label: string; value: number };
  index?: number;
  className?: string;
}

const TICKS = 60;

/**
 * Hero KPI (Lens `kpi_hero`, dark mockup "SLA compliance"): one dominant number, up to four
 * supporting metrics and a 60-tick meter that wipes in once. Use it when one headline metric
 * deserves the most space on the page (principle 7).
 */
export const KpiHero: React.FC<KpiHeroProps> = ({
  label,
  value,
  unit,
  delta,
  metrics = [],
  meter,
  index = 0,
  className,
  info,
  calc,
}) => {
  const curtainId = useId();
  const hasCurtain = Boolean(info || calc);
  const on = meter ? Math.round(Math.max(0, Math.min(1, meter.value)) * TICKS) : 0;

  return (
    <div
      className={cx('u-card u-card--pad u-curtain-host flex min-h-[280px] flex-col justify-between', className)}
      style={stagger('--i', index)}
      tabIndex={hasCurtain ? 0 : undefined}
      aria-describedby={hasCurtain ? curtainId : undefined}
    >
      <div className="flex flex-wrap justify-between gap-8">
        <div>
          <p className="text-[13px] font-medium text-u-label">{label}</p>
          <p
            className="u-num mt-3 whitespace-nowrap text-[clamp(52px,6vw,84px)] font-semibold leading-none tracking-[-0.045em] text-u-title"
            style={{ animation: 'u-fade .9s var(--u-ease) .15s both' }}
          >
            {value}
            {unit && <span className="ml-1 text-[0.52em] tracking-[-0.02em] text-u-label">{unit}</span>}
          </p>
          {delta && (
            <p
              className={cx('mt-3 text-[13px] font-semibold', delta.favourable ? 'text-u-delta-up' : 'text-u-delta-down')}
              style={{ animation: 'u-fade .6s var(--u-ease) .45s both' }}
            >
              {delta.text}
            </p>
          )}
        </div>
        {metrics.length > 0 && (
          <dl className="w-full max-w-[320px]">
            {metrics.slice(0, 4).map((m, k) => (
              <div
                key={m.label}
                className="flex items-baseline justify-between border-b border-u-grid py-2.5"
                style={{ ...stagger('--k', k), animation: 'u-fade .6s var(--u-ease) calc(.3s + var(--k) * 90ms) both' }}
              >
                <dt className="text-[13px] text-u-label">{m.label}</dt>
                <dd className="u-num text-[18px] font-semibold text-u-title">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {meter && (
        <div className="mt-6">
          <div
            className="flex h-[30px] items-center gap-[5px]"
            role="meter"
            aria-label={meter.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter.value * 100)}
            style={{ animation: 'u-wipe 1.4s var(--u-ease) .5s both' }}
          >
            {Array.from({ length: TICKS }, (_, i) => (
              <i key={i} className={cx('flex-1 rounded-[2px]', i < on ? 'h-[30px] bg-u-primary' : 'h-1 bg-u-track')} />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[13px] font-medium text-u-label">
            <span>{meter.label}</span>
            <b className="u-num text-[15px] font-semibold text-u-title">{Math.round(meter.value * 100)}%</b>
          </div>
        </div>
      )}
      {hasCurtain && <InfoCurtain id={curtainId} info={info} calc={calc} />}
    </div>
  );
};
