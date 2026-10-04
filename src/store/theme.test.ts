import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isThemeName, resolveInitialTheme, THEME_STORAGE_KEY, useThemeStore } from './theme';

describe('theme selection', () => {
  it('a remembered choice wins over the OS preference', () => {
    expect(resolveInitialTheme('nocturne', false)).toBe('nocturne');
    expect(resolveInitialTheme('neoglass', true)).toBe('neoglass');
  });

  it('first visit follows prefers-color-scheme', () => {
    expect(resolveInitialTheme(null, true)).toBe('nocturne');
    expect(resolveInitialTheme(null, false)).toBe('neoglass');
    expect(resolveInitialTheme('purple', false)).toBe('neoglass');
  });

  it('only accepts the two Univerus templates', () => {
    expect(isThemeName('neoglass')).toBe(true);
    expect(isThemeName('nocturne')).toBe(true);
    expect(isThemeName('dark')).toBe(false);
  });

  it('toggle switches between the templates (storage failures are tolerated)', () => {
    const start = useThemeStore.getState().theme;
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).not.toBe(start);
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe(start);
  });

  it('the pre-paint script in index.html reads the same storage key', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    expect(html).toContain("prefers-color-scheme: dark");
  });
});
