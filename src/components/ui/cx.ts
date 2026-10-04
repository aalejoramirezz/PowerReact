import type React from 'react';

/** Joins truthy class names. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Inline style carrying a stagger index (`--i` for cards, `--k` for rows). */
export function stagger(name: '--i' | '--k', index: number): React.CSSProperties {
  return { [name]: index } as React.CSSProperties;
}
