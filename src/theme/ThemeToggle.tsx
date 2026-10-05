import type React from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEMES, useThemeStore } from '../store/theme';

/** Switches Neo-Glass (light) <-> Nocturne (dark) for the whole app. Lives in the shell header. */
export const ThemeToggle: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'nocturne';
  const next = THEMES[isDark ? 'neoglass' : 'nocturne'];

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={`Switch to ${next.label} (${next.mode} theme)`}
      title={`${THEMES[theme].label} theme · switch to ${next.label}`}
      data-testid="theme-toggle"
      className="relative flex h-8 w-[58px] cursor-pointer items-center rounded-full border border-u-shell-control-border bg-u-shell-control-bg p-[3px] transition-colors"
    >
      <span
        className={`absolute top-[3px] h-[24px] w-[24px] rounded-full bg-u-shell-control-active-bg transition-transform duration-300 ${
          isDark ? 'translate-x-[26px]' : 'translate-x-0'
        }`}
        aria-hidden="true"
      />
      <span className="relative z-10 grid h-[24px] w-[24px] place-items-center text-u-shell-header-text">
        <Sun className={`h-3.5 w-3.5 ${isDark ? 'opacity-50' : ''}`} />
      </span>
      <span className="relative z-10 ml-[2px] grid h-[24px] w-[24px] place-items-center text-u-shell-header-text">
        <Moon className={`h-3.5 w-3.5 ${isDark ? '' : 'opacity-50'}`} />
      </span>
    </button>
  );
};
