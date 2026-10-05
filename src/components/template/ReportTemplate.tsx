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
  /** Overrides the data area's bottom padding (e.g. room for the briefing mini-player). */
  contentClassName?: string;
}

/**
 * The Univerus report template, one markup for both themes:
 *  - Neo-Glass: quiet technical backdrop, one frosted-glass plane, logo · eyebrow · title, teal rule.
 *  - Nocturne: navy/teal backdrop, an obsidian window with a teal glow rising from its base.
 * The data area scrolls inside the plane; the glow stays anchored to the window.
 *
 * Responsive: the plane is a named size container (`@container/plane`), so header and toolbar
 * respond to the report's own width (`@md/plane:`), and the data area is a second container for the
 * visuals (`@md:`). On phones the plane hugs the viewport (surfaces.css) and the gutters shrink.
 */
export const ReportTemplate: React.FC<ReportTemplateProps> = ({
  eyebrow,
  title,
  meta,
  actions,
  toolbar,
  children,
  className,
  contentClassName,
}) => (
  <div className={cx('u-scene relative h-full w-full flex-1', className)}>
    <div className="u-scene-ambient" aria-hidden="true" />
    <section className="u-plane @container/plane" aria-label={title}>
      <div className="u-plane-glow" aria-hidden="true" />
      <div className="u-plane-rays" aria-hidden="true" />

      {/* z-[3]: header popovers must paint over the toolbar (z-[2]) and the data area (z-[1]) */}
      <header className="relative z-[3] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pb-3 pt-4 @md/plane:px-7">
        <div
          className="flex min-w-0 items-center gap-3 @md/plane:gap-[18px]"
          style={{ animation: 'u-rise .72s var(--u-ease) both' }}
        >
          <UniverusLogo className="h-auto w-[60px] shrink-0 @md/plane:w-[78px]" />
          <span className="u-header-divider h-10" aria-hidden="true" />
          <div className="min-w-0">
            <p className="u-eyebrow">{eyebrow}</p>
            <h1 className="mt-1 line-clamp-2 font-display text-[18px] font-semibold leading-tight tracking-[-0.03em] text-u-title @md/plane:truncate @md/plane:text-[22px]">
              {title}
            </h1>
          </div>
        </div>
        {(meta || actions) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 @md/plane:gap-3" style={{ animation: 'u-fade .7s var(--u-ease) .2s both' }}>
            {meta}
            {actions}
          </div>
        )}
      </header>

      <div className="u-rule relative z-[2] mx-4 @md/plane:mx-7" aria-hidden="true" />

      {toolbar && <div className="relative z-[2] px-4 pt-3 @md/plane:px-7">{toolbar}</div>}

      {/* A size container: layouts respond to the report's width (sidebar, chat drawer), not the viewport */}
      <div
        className={cx(
          '@container relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pt-4 @md/plane:px-7',
          contentClassName ?? 'pb-8'
        )}
        data-testid="report-content"
      >
        {children}
      </div>
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
