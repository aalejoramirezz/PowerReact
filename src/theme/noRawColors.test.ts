import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Colours come only from the theme" (Lens rule 6), made mechanical: components and stylesheets may
 * not use stock Tailwind palette classes or literal colours. Only src/theme/tokens.css defines colours;
 * the web components (packages/univerus-elements) read the same roles through var(--u-*).
 */

const ROOTS = ['src', 'packages/univerus-elements/src'];
const ALLOWED = new Set([path.normalize('src/theme/tokens.css')]);
/** Generated code (React wrappers, Stencil typings) is not authored, so it is not scanned. */
const SKIP_DIRS = new Set(['__fixtures__', 'generated']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : files(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [full] : [];
  });
}

const PALETTE =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|placeholder|divide|outline|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

describe('no raw colours outside the tokens', () => {
  const targets = ROOTS.flatMap(files).filter((f) => !ALLOWED.has(path.normalize(f)));

  it('scans the component and style sources, web components included', () => {
    expect(targets.length).toBeGreaterThan(20);
    expect(targets.some((f) => f.includes(path.normalize('univerus-elements/src/styles/surfaces.css')))).toBe(true);
  });

  it.each(targets)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const hits = [...(source.match(PALETTE) ?? []), ...(source.match(LITERAL) ?? [])];
    expect(hits, `use a token role (bg-u-*, text-u-*, var(--u-*)) instead of: ${hits.join(', ')}`).toEqual([]);
  });
});
