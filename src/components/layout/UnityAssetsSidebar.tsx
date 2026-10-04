import React, { useState } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '../../routes';

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

export const UnityAssetsSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const renderContent = (item: MenuItem, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <>
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-u-sidebar-active-text' : 'text-u-sidebar-muted'}`} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </div>
        {!collapsed && item.badge && (
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
    <aside
      className={`bg-u-sidebar-bg border-r border-u-sidebar-border flex flex-col shrink-0 transition-[width] duration-200 select-none ${
        collapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Collapse Toggle */}
      <div className="h-9 flex items-center justify-end px-2 border-b border-u-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-u-sidebar-muted hover:text-u-title p-1 rounded hover:bg-u-sidebar-hover transition-colors cursor-pointer"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto py-1.5 space-y-0.5">
        {MENU_ITEMS.map((item) =>
          item.to ? (
            <NavLink key={item.label} to={item.to} title={item.label} className={({ isActive }) => itemClass(isActive)}>
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
  );
};
