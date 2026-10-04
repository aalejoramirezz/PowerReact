import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { errorMessage } from '../../api/http';
import { cx } from './cx';

export type Tone = 'ok' | 'warn' | 'bad' | 'accent' | 'neutral';

/** Status / variance chip (DESIGN.md "Chips & Badges"); tone comes from the theme status roles. */
export const StatusChip: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span className={cx('u-chip', className)} data-tone={tone === 'neutral' ? undefined : tone}>
    {children}
  </span>
);

/** Segmented control (mockup header tabs). Buttons keep aria-pressed so they read as toggles. */
export const Tabs: React.FC<{ children: React.ReactNode; label: string; className?: string }> = ({
  children,
  label,
  className,
}) => (
  <div className={cx('u-tabs', className)} role="group" aria-label={label}>
    {children}
  </div>
);

export const Tab: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }> = ({
  active,
  className,
  ...rest
}) => <button type="button" className={cx('u-tab', className)} aria-pressed={active} {...rest} />;

export interface LegendItem {
  label: string;
  /** CSS colour, normally a token: 'var(--u-primary)'. */
  color: string;
  variant?: 'solid' | 'dashed' | 'outline';
}

/** Small legend near the title, reduced contrast (principle 28). */
export const Legend: React.FC<{ items: LegendItem[]; className?: string }> = ({ items, className }) => (
  <div className={cx('flex flex-wrap items-center gap-3', className)}>
    {items.map((item) => (
      <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-u-label">
        <i
          className="inline-block h-2 w-2.5 rounded-[2px]"
          style={
            item.variant === 'outline'
              ? { border: `1.5px solid ${item.color}` }
              : item.variant === 'dashed'
                ? { borderTop: `2px dashed ${item.color}`, height: 0, borderRadius: 0 }
                : { background: item.color }
          }
          aria-hidden="true"
        />
        {item.label}
      </span>
    ))}
  </div>
);

/** Thin progress meter (track + primary fill). value 0..1. */
export const MiniMeter: React.FC<{ value: number; className?: string; label?: string }> = ({ value, className, label }) => (
  <span
    className={cx('block h-1.5 overflow-hidden rounded-full bg-u-track', className)}
    role={label ? 'meter' : undefined}
    aria-label={label}
    aria-valuemin={label ? 0 : undefined}
    aria-valuemax={label ? 100 : undefined}
    aria-valuenow={label ? Math.round(value * 100) : undefined}
  >
    <span
      className="block h-full origin-left rounded-full"
      style={{
        width: `${Math.min(100, Math.max(0, value * 100))}%`,
        background: 'linear-gradient(90deg, var(--u-bar-1), var(--u-bar-2) 60%, var(--u-bar-3))',
        animation: 'u-grow 1.1s var(--u-ease) .3s both',
      }}
    />
  </span>
);

export const LoadingState: React.FC<{ label?: string; rows?: number }> = ({
  label = 'Executing VertiPaq DAX query...',
  rows = 0,
}) => (
  <div className="flex flex-col gap-3 py-2" role="status" aria-live="polite">
    {Array.from({ length: rows }, (_, i) => (
      <span key={i} className="u-skeleton h-9 w-full" style={{ opacity: 1 - i * 0.12 }} />
    ))}
    <span className="flex items-center justify-center gap-2 py-4 text-[12px] text-u-label">
      <span className="u-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-u-track border-t-u-primary" />
      {label}
    </span>
  </div>
);

export const ErrorNote: React.FC<{ error: unknown }> = ({ error }) => (
  <div className="flex items-start gap-2 rounded-lg bg-u-bad-bg p-3 text-[12px] text-u-bad-text">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{errorMessage(error)}</span>
  </div>
);

export const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="py-10 text-center text-[12px] text-u-label">{children}</div>
);
