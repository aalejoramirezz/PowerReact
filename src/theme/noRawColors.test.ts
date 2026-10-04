import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Colours come only from the theme" (Lens rule 6), made mechanical: components and stylesheets may
 * not use stock Tailwind palette classes or literal colours. Only src/theme/tokens.css defines colours.
 */

const ROOT = 'src';
const ALLOWED = new Set([path.normalize('src/theme/tokens.css')]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__fixtures__' ? [] : files(full);
    return /\.(tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const PALETTE =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|placeholder|divide|outline|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

describe('no raw colours outside the tokens', () => {
  const targets = files(ROOT).filter((f) => !ALLOWED.has(path.normalize(f)));

  it('scans the component and style sources', () => {
    expect(targets.length).toBeGreaterThan(20);
  });

  it.each(targets)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const hits = [...(source.match(PALETTE) ?? []), ...(source.match(LITERAL) ?? [])];
    expect(hits, `use a token role (bg-u-*, text-u-*, var(--u-*)) instead of: ${hits.join(', ')}`).toEqual([]);
  });
});
