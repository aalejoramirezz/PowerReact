import type React from 'react';
import { cx } from '../ui/cx';
import { UniverusLogo } from './UniverusLogo';

interface ReportTemplateProps {
  /** Small uppercase kicker above the title (Neo-Glass eyebrow / Nocturne subtitle tone). */
  eyebrow: string;
  title: string;
  /** Right side of the header: context (model, period) and actions. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Row under the teal rule (filters, tabs). */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The Univerus report template, one markup for both themes:
 *  - Neo-Glass: quiet technical backdrop, one frosted-glass plane, logo · eyebrow · title, teal rule.
 *  - Nocturne: navy/teal backdrop, an obsidian window with a teal glow rising from its base.
 * The data area scrolls inside the plane; the glow stays anchored to the window.
 */
export const ReportTemplate: React.FC<ReportTemplateProps> = ({ eyebrow, title, meta, actions, toolbar, children, className }) => (
  <div className={cx('u-scene relative h-full w-full flex-1', className)}>
    <div className="u-scene-ambient" aria-hidden="true" />
    <section className="u-plane" aria-label={title}>
      <div className="u-plane-glow" aria-hidden="true" />
      <div className="u-plane-rays" aria-hidden="true" />

      <header className="relative z-[2] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-7 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-[18px]" style={{ animation: 'u-rise .72s var(--u-ease) both' }}>
          <UniverusLogo className="h-auto w-[78px] shrink-0" />
          <span className="u-header-divider h-10" aria-hidden="true" />
          <div className="min-w-0">
            <p className="u-eyebrow">{eyebrow}</p>
            <h1 className="mt-1 truncate font-display text-[22px] font-semibold leading-tight tracking-[-0.03em] text-u-title">
              {title}
            </h1>
          </div>
        </div>
        {(meta || actions) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3" style={{ animation: 'u-fade .7s var(--u-ease) .2s both' }}>
            {meta}
            {actions}
          </div>
        )}
      </header>

      <div className="u-rule relative z-[2] mx-7" aria-hidden="true" />

      {toolbar && <div className="relative z-[2] px-7 pt-3">{toolbar}</div>}

      {/* A size container: layouts respond to the report's width (sidebar, chat drawer), not the viewport */}
      <div className="@container relative z-[1] min-h-0 flex-1 overflow-y-auto px-7 pb-8 pt-4">{children}</div>
    </section>
  </div>
);

/** Small "label / value" pair for the header meta area (light mockup "Reporting period"). */
export const HeaderMeta: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="text-right">
    <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-u-label">{label}</span>
    <span className="mt-0.5 block text-[12px] font-semibold text-u-text-soft">{children}</span>
  </div>
);
