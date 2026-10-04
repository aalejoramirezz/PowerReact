import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { cx, stagger } from './cx';
import { InfoCurtain, type CurtainContent } from './InfoCurtain';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
  /** Entrance stagger position. */
  index?: number;
  /** Apply the theme card padding. */
  padded?: boolean;
}

/** The standard chart surface: every visual sits on exactly one Card (principle 5). */
export const Card: React.FC<CardProps> = ({ as: Tag = 'section', index = 0, padded = true, className, style, ...rest }) => (
  <Tag className={cx('u-card', padded && 'u-card--pad', className)} style={{ ...stagger('--i', index), ...style }} {...rest} />
);

interface ChartCardProps extends CurtainContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Legend, counters or controls aligned right of the title (principle 28: legends near the title). */
  aside?: React.ReactNode;
  index?: number;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

/**
 * A Card with the standard header (title, subtitle, aside) and, when `info`/`calc` are given,
 * an ⓘ button that drops the same curtain the KPI cards show on hover. The button keeps the chart
 * itself fully clickable: the curtain only appears when asked for.
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  aside,
  info,
  calc,
  index = 0,
  className,
  bodyClassName,
  children,
  'data-testid': testId,
}) => {
  const [open, setOpen] = useState(false);
  const curtainId = useId();
  const hasCurtain = Boolean(info || calc);

  return (
    <Card
      index={index}
      className={cx('flex flex-col', className)}
      data-testid={testId}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') setOpen(false);
      }}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="u-card-title truncate">{title}</h3>
          {subtitle && <p className="u-card-subtitle mt-1">{subtitle}</p>}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {aside}
          {hasCurtain && (
            <button
              type="button"
              className="u-icon-btn"
              aria-expanded={open}
              aria-controls={curtainId}
              aria-label={open ? 'Hide what this chart means' : 'What this chart means'}
              title="What it means"
              onClick={() => setOpen(!open)}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
      {hasCurtain && <InfoCurtain id={curtainId} info={info} calc={calc} open={open} onClose={() => setOpen(false)} />}
    </Card>
  );
};
