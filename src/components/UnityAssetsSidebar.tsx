import React, { useState } from 'react';
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
} from 'lucide-react';

interface UnityAssetsSidebarProps {
  activeItem?: string;
  onSelectItem?: (item: string) => void;
}

export const UnityAssetsSidebar: React.FC<UnityAssetsSidebarProps> = ({
  activeItem = 'Report',
  onSelectItem,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const menuItems: { id: string; label: string; icon: any; badge?: string }[] = [
    { id: 'Asset Management', label: 'Asset Management', icon: Package, badge: 'React DAX' },
    { id: 'Report', label: 'Report', icon: BarChart2, badge: 'Embed' },
    { id: 'Asset Routing', label: 'Asset Routing', icon: Compass },
    { id: 'Compliance', label: 'Compliance', icon: ClipboardCheck },
    { id: 'Crew Routing', label: 'Crew Routing', icon: Users },
    { id: 'Dispatch', label: 'Dispatch', icon: Send },
    { id: 'Equipment Inspection', label: 'Equipment Inspection', icon: FileCheck2 },
    { id: 'Facility Scheduling', label: 'Facility Scheduling', icon: Calendar },
    { id: 'Mobility', label: 'Mobility', icon: Smartphone },
    { id: 'Fixed Assets', label: 'Fixed Assets', icon: Building2 },
    { id: 'Fleet Management', label: 'Fleet Management', icon: Truck },
    { id: 'GIS Plugin', label: 'GIS Plugin', icon: MapPin },
    { id: 'Dispatcher', label: 'Dispatcher', icon: Headphones },
    { id: 'Health & Safety', label: 'Health & Safety', icon: HeartHandshake },
  ];

  return (
    <aside
      className={`bg-[#f8fafc] border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 select-none ${
        collapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Collapse Toggle */}
      <div className="h-9 flex items-center justify-end px-2 border-b border-slate-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition-colors cursor-pointer"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto py-1.5 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectItem?.(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-slate-200/70 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal'
              }`}
              title={item.label}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!collapsed && item.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                    item.id === 'Asset Management'
                      ? 'bg-teal-100 text-teal-800 border border-teal-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
