import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  BarChart2,
  Compass,
  ClipboardCheck,
  Users,
  Send,
  FileCheck2,
  Calendar,
  Smartphone,
  Building2,
  Truck,
  MapPin,
  Headphones,
  HeartHandshake,
  Palette,
  FileJson,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLatestRef } from '../../hooks/useLatestRef';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ROUTES } from '../../routes';
import { cx } from '../ui/cx';

interface MenuItem {
  label: string;
  icon: LucideIcon;
  /** Only modules with a route are navigable in this demo. */
  to?: string;
  badge?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Asset Management', icon: Package, to: ROUTES.visuals, badge: 'React DAX' },
  { label: 'Report', icon: BarChart2, to: ROUTES.report, badge: 'Embed' },
  { label: 'Design Gallery', icon: Palette, to: ROUTES.gallery, badge: 'UI' },
  { label: 'Manifest Preview', icon: FileJson, to: ROUTES.manifestPreview, badge: 'JSON' },
  { label: 'Asset Routing', icon: Compass },
  { label: 'Compliance', icon: ClipboardCheck },
  { label: 'Crew Routing', icon: Users },
  { label: 'Dispatch', icon: Send },
  { label: 'Equipment Inspection', icon: FileCheck2 },
  { label: 'Facility Scheduling', icon: Calendar },
  { label: 'Mobility', icon: Smartphone },
  { label: 'Fixed Assets', icon: Building2 },
  { label: 'Fleet Management', icon: Truck },
  { label: 'GIS Plugin', icon: MapPin },
  { label: 'Dispatcher', icon: Headphones },
  { label: 'Health & Safety', icon: HeartHandshake },
];

const itemClass = (isActive: boolean, disabled = false) =>
  `w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
    disabled
      ? 'text-u-sidebar-muted cursor-not-allowed font-normal'
      : isActive
        ? 'bg-u-sidebar-active-bg text-u-sidebar-active-text font-semibold cursor-pointer shadow-[inset_3px_0_0_var(--u-interaction)]'
        : 'text-u-sidebar-text hover:bg-u-sidebar-hover hover:text-u-title font-normal cursor-pointer'
  }`;

interface UnityAssetsSidebarProps {
  /** Below lg: whether the off-canvas drawer is open. */
  mobileOpen: boolean;
  onClose: () => void;
}

/** Same breakpoint as Tailwind's `lg` (64rem): below it the sidebar is a drawer. */
const DRAWER_QUERY = '(max-width: 1023.98px)';

/**
 * Module navigation. ≥ lg: a persistent, collapsible column. < lg: an off-canvas drawer opened from
 * the header's menu button, over an overlay; Esc, the overlay or picking a module closes it, and it
 * is `inert` while closed so its links are not tabbable off screen.
 */
export const UnityAssetsSidebar: React.FC<UnityAssetsSidebarProps> = ({ mobileOpen, onClose }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const drawerOpen = isDrawer && mobileOpen;
  const isCollapsed = collapsed && !isDrawer;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useLatestRef(onClose);

  // Drawer: focus moves in on open, Esc closes, focus returns to the opener (the menu button)
  useEffect(() => {
    if (!drawerOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [drawerOpen, onCloseRef]);

  const renderContent = (item: MenuItem, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <>
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-u-sidebar-active-text' : 'text-u-sidebar-muted'}`} />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </div>
        {!isCollapsed && item.badge && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
              item.to === ROUTES.visuals ? 'bg-u-mark-bg text-u-mark-fg' : 'bg-u-track text-u-label'
            }`}
          >
            {item.badge}
          </span>
        )}
      </>
    );
  };

  return (
    <>
      {drawerOpen && (
        <div
          className="u-anim-fade fixed inset-0 z-40 bg-u-overlay"
          onClick={onClose}
          aria-hidden="true"
          data-testid="nav-overlay"
        />
      )}
      <aside
        id="app-sidebar"
        aria-label="Modules"
        // React 18 passes `inert` through as a plain attribute (src/types/react-inert.d.ts)
        {...(isDrawer && !mobileOpen ? { inert: '' } : {})}
        className={cx(
          'flex shrink-0 select-none flex-col border-r border-u-sidebar-border bg-u-sidebar-bg',
          // < lg: off-canvas drawer
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-64 max-lg:transition-[translate] max-lg:duration-200 max-lg:ease-out',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          // ≥ lg: persistent column
          'lg:transition-[width] lg:duration-200',
          isCollapsed ? 'lg:w-12' : 'lg:w-56'
        )}
        style={drawerOpen ? { boxShadow: 'var(--u-modal-shadow)' } : undefined}
      >
        {/* Drawer: brand + close. Desktop: collapse toggle */}
        <div className="flex h-12 items-center justify-between gap-2 border-b border-u-sidebar-border px-3 lg:hidden">
          <span className="font-display text-sm font-semibold tracking-tight text-u-title">Unity Assets</span>
          <button ref={closeRef} type="button" onClick={onClose} className="u-icon-btn" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex h-9 items-center justify-end border-b border-u-sidebar-border px-2 max-lg:hidden">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="cursor-pointer rounded p-1 text-u-sidebar-muted transition-colors hover:bg-u-sidebar-hover hover:text-u-title"
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav List */}
        <nav className="flex-1 overflow-y-auto py-1.5 space-y-0.5">
          {MENU_ITEMS.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                title={item.label}
                className={({ isActive }) => itemClass(isActive)}
                onClick={() => {
                  if (isDrawer) onClose();
                }}
              >
                {({ isActive }) => renderContent(item, isActive)}
              </NavLink>
            ) : (
              <button
                key={item.label}
                type="button"
                disabled
                className={itemClass(false, true)}
                title={`${item.label} is not part of this demo`}
              >
                {renderContent(item, false)}
              </button>
            )
          )}
        </nav>
      </aside>
    </>
  );
};
