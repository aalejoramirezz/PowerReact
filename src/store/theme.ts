import { create } from 'zustand';

/** The two Univerus templates: Neo-Glass (light) and Nocturne (dark). */
export type ThemeName = 'neoglass' | 'nocturne';

export const THEME_STORAGE_KEY = 'powerreact-theme';

export const THEMES: Record<ThemeName, { label: string; mode: 'light' | 'dark' }> = {
  neoglass: { label: 'Neo-Glass', mode: 'light' },
  nocturne: { label: 'Nocturne', mode: 'dark' },
};

export const isThemeName = (value: unknown): value is ThemeName => value === 'neoglass' || value === 'nocturne';

/** A remembered choice wins; otherwise follow the OS colour scheme. Mirrors the inline script in index.html. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): ThemeName {
  if (isThemeName(stored)) return stored;
  return prefersDark ? 'nocturne' : 'neoglass';
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function initialTheme(): ThemeName {
  if (typeof document === 'undefined') return 'neoglass';
  const fromDocument = document.documentElement.dataset.theme;
  if (isThemeName(fromDocument)) return fromDocument;
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveInitialTheme(readStored(), prefersDark);
}

/**
 * Swap instantly (better-ui "Suppress transitions on theme switch"): nearly every element changes
 * colour, border and shadow at once, so running their transitions would smear the switch. Disable
 * transitions, flip the attribute, force a style flush, and restore them after the next paint.
 */
function applyTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;

  const freeze = document.createElement('style');
  freeze.append(document.createTextNode('*,*::before,*::after{transition:none !important}'));
  document.head.append(freeze);
  root.dataset.theme = theme;
  void document.body.offsetHeight; // flush styles while transitions are off
  requestAnimationFrame(() => requestAnimationFrame(() => freeze.remove()));
}

function persist(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the theme still applies for this session
  }
}

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    persist(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'neoglass' ? 'nocturne' : 'neoglass'),
}));
