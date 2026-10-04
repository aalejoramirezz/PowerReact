#!/usr/bin/env node
/**
 * Keeps the agent skills consistent (port of Univerus-Lens core/compiler/tools/sync_agent_skills.py).
 *
 *  1. .agents/skills/ is the ONLY place skills are edited (tool-neutral: Codex, Cursor, Gemini… read it).
 *  2. Claude Code reads .claude/skills/: that folder is regenerated from the canonical one, never edited.
 *  3. powerreact-design-system/references/tokens.md is generated from src/theme/tokens.css, so the
 *     documented colour roles can never drift from the code.
 *  4. Third-party skills listed in skills-lock.json (installed with `npx skills add … --copy`) are
 *     vendored: never edited here. Update them with `npx skills update`, then re-run this sync.
 *
 *    node scripts/sync-agent-skills.mjs          # regenerate
 *    node scripts/sync-agent-skills.mjs --check  # exit 1 when anything is out of date (CI)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '.agents', 'skills');
const MIRRORS = [path.join(ROOT, '.claude', 'skills')];
const TOKENS_CSS = path.join(ROOT, 'src', 'theme', 'tokens.css');
const TOKENS_MD = path.join(SRC, 'powerreact-design-system', 'references', 'tokens.md');

const LOCK = path.join(ROOT, 'skills-lock.json');
const vendored = () => (existsSync(LOCK) ? (JSON.parse(readFileSync(LOCK, 'utf8')).skills ?? {}) : {});

const note = (name) => {
  const source = vendored()[name]?.source;
  return source
    ? `<!-- VENDORED skill from github.com/${source} (skills-lock.json), mirrored by scripts/sync-agent-skills.mjs. Do not edit: run npx skills update, then npm run skills:sync. -->\n`
    : `<!-- GENERATED COPY of .agents/skills/${name}/SKILL.md by scripts/sync-agent-skills.mjs. Edit the canonical file, then run npm run skills:sync. -->\n`;
};

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

/* ───────── tokens.md from tokens.css ───────── */

function block(css, selector) {
  const start = css.indexOf('{', css.indexOf(selector));
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  throw new Error(`unterminated block ${selector}`);
}

function declarations(body) {
  const out = new Map();
  for (const m of body.matchAll(/--u-([\w-]+):\s*([^;]+);/g)) out.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  return out;
}

function tokensMarkdown() {
  const css = read(TOKENS_CSS);
  const light = declarations(block(css, ":root[data-theme='neoglass']"));
  const dark = declarations(block(css, ":root[data-theme='nocturne']"));
  const cell = (v) => (v === undefined ? '_(same as Neo-Glass)_' : `\`${v.replace(/\|/g, '\\|')}\``);
  const rows = [...light.keys()].map((role) => `| \`--u-${role}\` | ${cell(light.get(role))} | ${cell(dark.get(role))} |`);
  return [
    '<!-- GENERATED from src/theme/tokens.css by scripts/sync-agent-skills.mjs. Do not edit: change the tokens and run npm run skills:sync. -->',
    '',
    '# Design tokens (all roles, both themes)',
    '',
    'Components use these roles through `bg-u-*` / `text-u-*` / `border-u-*` utilities (mapped in `src/index.css`) or `var(--u-*)`.',
    'Values are CSS as written in `src/theme/tokens.css`.',
    '',
    '| Role | Neo-Glass (light) | Nocturne (dark) |',
    '| :--- | :--- | :--- |',
    ...rows,
    '',
  ].join('\n');
}

/* ───────── mirrors ───────── */

function expectedMirror(name, relative) {
  const content = read(path.join(SRC, name, relative));
  if (relative !== 'SKILL.md') return content;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3) + 4;
    return `${content.slice(0, end)}\n${note(name)}${content.slice(end)}`;
  }
  return note(name) + content;
}

const skills = () => readdirSync(SRC).filter((name) => statSync(path.join(SRC, name)).isDirectory());

function outOfDate() {
  const stale = [];
  if (!existsSync(TOKENS_MD) || read(TOKENS_MD) !== tokensMarkdown()) stale.push(path.relative(ROOT, TOKENS_MD));
  for (const mirror of MIRRORS) {
    for (const name of skills()) {
      for (const relative of listFiles(path.join(SRC, name))) {
        const target = path.join(mirror, name, relative);
        if (!existsSync(target) || read(target) !== expectedMirror(name, relative)) stale.push(path.relative(ROOT, target));
      }
    }
    if (existsSync(mirror)) {
      for (const relative of listFiles(mirror)) {
        const [name, ...rest] = relative.split(path.sep);
        if (!existsSync(path.join(SRC, name ?? '', ...rest))) stale.push(`${path.relative(ROOT, path.join(mirror, relative))} (not in .agents/skills)`);
      }
    }
  }
  return stale;
}

function sync() {
  mkdirSync(path.dirname(TOKENS_MD), { recursive: true });
  writeFileSync(TOKENS_MD, tokensMarkdown());
  for (const mirror of MIRRORS) {
    rmSync(mirror, { recursive: true, force: true });
    for (const name of skills()) {
      for (const relative of listFiles(path.join(SRC, name))) {
        const target = path.join(mirror, name, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, expectedMirror(name, relative));
      }
    }
    console.log(`synced ${skills().length} skills -> ${path.relative(ROOT, mirror)} (+ tokens.md)`);
  }
}

if (process.argv.includes('--check')) {
  const stale = outOfDate();
  if (stale.length) {
    console.error(['OUT OF DATE (run npm run skills:sync):', ...stale.map((s) => `  ${s}`)].join('\n'));
    process.exit(1);
  }
  console.log('skills, mirrors and tokens.md are up to date');
} else {
  sync();
}
