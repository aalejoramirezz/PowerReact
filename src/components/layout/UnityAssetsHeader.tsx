import React from 'react';
import { NavLink } from 'react-router';
import { Bot, Grid3X3, HelpCircle, Languages, Menu, Settings, Sparkles } from 'lucide-react';
import { ROUTES, VIEW_LABELS, type ViewId } from '../../routes';
import { ThemeToggle } from '../../theme/ThemeToggle';
import type { HealthStatus } from '../../types';
import { cx } from '../ui/cx';

interface UnityAssetsHeaderProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  status?: HealthStatus | null;
  activeView: ViewId | null;
  /** Below lg the sidebar is an off-canvas drawer opened from here. */
  navOpen: boolean;
  onOpenNav: () => void;
}

const modeLink = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors',
    isActive ? 'bg-u-shell-control-active-bg text-u-shell-header-text' : 'text-u-shell-header-muted hover:text-u-shell-header-text'
  );

const iconButton =
  'cursor-pointer rounded p-1.5 text-u-shell-header-muted transition-colors hover:bg-u-shell-control-bg hover:text-u-shell-header-text';

/**
 * Product shell header: DESIGN.md navigation slate in Neo-Glass, the obsidian window tone in Nocturne.
 * Responsive: < lg a menu button replaces the app launcher and the view switcher (the drawer covers
 * navigation); < md the breadcrumb and system icons go and "Chat with Data" keeps only its icon.
 */
export const UnityAssetsHeader: React.FC<UnityAssetsHeaderProps> = ({
  isChatOpen,
  onToggleChat,
  status,
  activeView,
  navOpen,
  onOpenNav,
}) => {
  return (
    <header className="z-30 flex h-12 shrink-0 select-none items-center justify-between gap-3 border-b border-u-shell-header-border bg-u-shell-header-bg px-3 text-u-shell-header-text md:px-4">
      {/* Left side: menu / waffle, brand, breadcrumb and view switcher */}
      <div className="flex min-w-0 items-center gap-3 lg:gap-6">
        <div className="flex items-center gap-2 lg:gap-3">
          <button
            type="button"
            className={cx(iconButton, 'lg:hidden')}
            onClick={onOpenNav}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button type="button" className={cx(iconButton, 'max-lg:hidden')} title="App launcher" aria-label="App launcher">
            <Grid3X3 className="h-4 w-4" />
          </button>
          <span className="whitespace-nowrap font-display text-sm font-semibold tracking-tight">Unity Assets</span>
        </div>

        <div className="hidden min-w-0 items-center gap-2 text-xs text-u-shell-header-muted md:flex">
          <span className="cursor-pointer transition-colors hover:text-u-shell-header-text">Home</span>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium text-u-shell-header-text">{activeView ? VIEW_LABELS[activeView] : ''}</span>
        </div>

        <nav
          aria-label="Report mode"
          className="hidden items-center rounded-lg border border-u-shell-control-border bg-u-shell-control-bg p-0.5 text-xs lg:flex"
        >
          <NavLink to={ROUTES.report} className={modeLink}>
            Power BI Embed (iFrame)
          </NavLink>
          <NavLink to={ROUTES.visuals} className={modeLink}>
            <span className="h-1.5 w-1.5 rounded-full bg-u-primary" aria-hidden="true" />
            React Semantic Visuals
          </NavLink>
        </nav>
      </div>

      {/* Right side: chat toggle, theme toggle and system icons */}
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onToggleChat}
          className={cx(
            'flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 md:px-3.5',
            isChatOpen
              ? 'border-u-primary bg-u-shell-control-active-bg text-u-shell-header-text'
              : 'border-u-shell-control-border bg-u-shell-control-bg text-u-shell-header-text hover:border-u-primary'
          )}
          title="Toggle Data Agent Chat"
          aria-pressed={isChatOpen}
        >
          {isChatOpen ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-u-primary" />}
          <span className="max-md:sr-only">Chat with Data</span>
          <span
            className={cx('h-1.5 w-1.5 rounded-full max-md:hidden', isChatOpen ? 'bg-u-primary' : 'bg-u-shell-header-muted')}
            aria-hidden="true"
          />
        </button>

        <ThemeToggle />

        {status?.configured && (
          <div
            className="hidden items-center gap-1.5 rounded-full border border-u-shell-control-border bg-u-shell-control-bg px-2.5 py-0.5 text-[11px] text-u-shell-header-muted lg:flex"
            title={`Tenant: ${status.tenantId} | Client: ${status.clientId || 'Configured'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-u-primary" />
            <span>SP Active</span>
          </div>
        )}

        <div className="mx-1 h-4 w-px bg-u-shell-control-border max-md:hidden" aria-hidden="true" />

        <button type="button" className={cx(iconButton, 'max-md:hidden')} title="Settings" aria-label="Settings">
          <Settings className="h-4 w-4" />
        </button>
        <button type="button" className={cx(iconButton, 'max-md:hidden')} title="Help" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button type="button" className={cx(iconButton, 'max-md:hidden')} title="Language" aria-label="Language">
          <Languages className="h-4 w-4" />
        </button>

        <div
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-u-shell-control-active-bg text-xs font-semibold text-u-shell-header-text"
          title="Alejandro (Admin)"
        >
          A
        </div>
      </div>
    </header>
  );
};
