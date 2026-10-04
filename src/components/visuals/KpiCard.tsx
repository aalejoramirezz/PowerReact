import type React from 'react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'blue' | 'emerald' | 'amber' | 'purple';

// Full class strings so Tailwind can see them at build time
const ACCENTS: Record<Accent, { icon: string; active: string; idle: string }> = {
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    active: 'border-blue-400 ring-2 ring-blue-400/20',
    idle: 'border-slate-200 hover:border-slate-300',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600',
    active: 'border-emerald-500 ring-2 ring-emerald-400/20 bg-emerald-50/20',
    idle: 'border-slate-200 hover:border-emerald-300',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    active: 'border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20',
    idle: 'border-slate-200 hover:border-amber-300',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-600',
    active: 'border-purple-400 ring-2 ring-purple-400/20',
    idle: 'border-slate-200 hover:border-teal-300',
  },
};

interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  accent: Accent;
  /** Already formatted value, or a placeholder while loading / on error. */
  value: string;
  /** Badge or unit rendered next to the value. */
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  active?: boolean;
  /** Showing previous filters' data while the new query runs. */
  stale?: boolean;
  onClick?: () => void;
  title?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  icon: Icon,
  accent,
  value,
  aside,
  footer,
  active = false,
  stale = false,
  onClick,
  title,
}) => {
  const styles = ACCENTS[accent];
  const className = `w-full text-left bg-white rounded-xl border p-4 shadow-xs transition-all select-none ${
    active ? styles.active : styles.idle
  } ${onClick ? 'cursor-pointer' : ''}`;

  const content = (
    <>
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`p-1.5 rounded-md ${styles.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`flex items-baseline gap-2 transition-opacity ${stale ? 'opacity-50' : ''}`}>
        <span
          className="text-2xl font-bold text-slate-900 font-mono tracking-tight"
          data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </span>
        {aside}
      </div>
      {footer}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className} title={title} aria-pressed={active}>
      {content}
    </button>
  ) : (
    <div className={className} title={title}>
      {content}
    </div>
  );
};
