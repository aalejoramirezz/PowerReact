import { call, treatAs, type DaxLiteralValue } from '../dax/daxBuilder';

/**
 * Cross-filters for manifest visuals. A manifest's DAX is trusted input (it comes from
 * Univerus-Lens or the report author, like a .pbix measure); what is never trusted is a clicked
 * value. Filters are therefore injected only here, by wrapping the query's single top-level table
 * expression in CALCULATETABLE(…, TREATAS({…}, 'table'[Column])) with escaped literals.
 */

export interface CrossFilterValue {
  /** Column reference, e.g. 'asset_class'[Asset_Class] or asset_class[Asset_Class]. */
  field: string;
  /** The column is in this list (OR). Several filters on one column intersect (AND), as in DAX. */
  values: readonly DaxLiteralValue[];
}

export interface DaxQueryParts {
  /** Everything before the top-level EVALUATE (DEFINE / VAR / MEASURE blocks), verbatim. */
  define: string;
  /** The table expression after EVALUATE, up to ORDER BY / START AT. */
  table: string;
  /** ORDER BY / START AT clause (and anything after it), verbatim. */
  tail: string;
}

interface Keyword {
  word: 'DEFINE' | 'EVALUATE' | 'ORDER BY' | 'START AT';
  start: number;
  end: number;
}

const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_.]/.test(ch);

/**
 * Finds DEFINE / EVALUATE / ORDER BY / START AT at the top level of a DAX query: outside "strings",
 * 'quoted tables', [brackets], comments (`--`, `//`, block) and parentheses.
 */
function topLevelKeywords(dax: string): Keyword[] {
  const found: Keyword[] = [];
  let depth = 0;
  let i = 0;
  const n = dax.length;

  const skipQuoted = (quote: string) => {
    // Escaped by doubling ("" inside strings, '' inside table names, ]] inside brackets)
    i++;
    while (i < n) {
      if (dax[i] === quote) {
        if (dax[i + 1] === quote) {
          i += 2;
          continue;
        }
        i++;
        return;
      }
      i++;
    }
  };

  while (i < n) {
    const ch = dax[i];
    const next = dax[i + 1];
    if (ch === '"' || ch === "'") {
      skipQuoted(ch);
      continue;
    }
    if (ch === '[') {
      skipQuoted(']');
      continue;
    }
    if ((ch === '-' && next === '-') || (ch === '/' && next === '/')) {
      while (i < n && dax[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = dax.indexOf('*/', i + 2);
      i = close < 0 ? n : close + 2;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[A-Za-z]/.test(ch ?? '') && !isWordChar(dax[i - 1])) {
      const rest = dax.slice(i);
      const match = /^(DEFINE|EVALUATE|ORDER\s+BY|START\s+AT)(?![A-Za-z0-9_.])/i.exec(rest);
      if (match) {
        const word = match[1].toUpperCase().replace(/\s+/, ' ') as Keyword['word'];
        found.push({ word, start: i, end: i + match[0].length });
        i += match[0].length;
        continue;
      }
      while (i < n && isWordChar(dax[i])) i++;
      continue;
    }
    i++;
  }
  return found;
}

/** Number of top-level EVALUATE statements (a manifest visual needs exactly one). */
export function countTopLevelEvaluate(dax: string): number {
  return topLevelKeywords(dax).filter((k) => k.word === 'EVALUATE').length;
}

export const hasSingleTopLevelEvaluate = (dax: string): boolean => countTopLevelEvaluate(dax) === 1;

/** Splits a query around its single top-level EVALUATE. */
export function splitDaxQuery(dax: string): DaxQueryParts {
  const keywords = topLevelKeywords(dax);
  const evaluates = keywords.filter((k) => k.word === 'EVALUATE');
  if (evaluates.length !== 1) throw new Error(`Expected exactly one top-level EVALUATE, found ${evaluates.length}`);
  const ev = evaluates[0] as Keyword;
  const after = keywords.find((k) => k.start > ev.start && (k.word === 'ORDER BY' || k.word === 'START AT'));
  return {
    define: dax.slice(0, ev.start),
    table: dax.slice(ev.end, after ? after.start : dax.length).trim(),
    tail: after ? dax.slice(after.start).trim() : '',
  };
}

/**
 * Validates a column reference and returns it in canonical quoted form: `'table'[Column]`.
 * Accepts `'Table name'[Column]` and `Table[Column]`; rejects anything else (no expressions).
 */
export function parseColumnRef(ref: string): string {
  const text = ref.trim();
  const quoted = /^'((?:[^']|'')+)'\[([^\]]+)\]$/.exec(text);
  const bare = /^([A-Za-z_][\w ]*)\[([^\]]+)\]$/.exec(text);
  const match = quoted ?? bare;
  if (!match) throw new Error(`Not a column reference: ${ref}`);
  const table = quoted ? (match[1] as string).replace(/''/g, "'") : (match[1] as string).trim();
  return `'${table.replace(/'/g, "''")}'[${match[2]}]`;
}

/** Same column regardless of quoting: 'asset_class'[Asset_Class] = asset_class[Asset_Class]. */
export function sameColumn(a: string, b: string): boolean {
  try {
    return parseColumnRef(a).toLowerCase() === parseColumnRef(b).toLowerCase();
  } catch {
    return a === b;
  }
}

/**
 * Applies cross-filters to a manifest query. Identity when there are none (same text ⇒ same cache
 * entry); otherwise `<define>EVALUATE CALCULATETABLE(<table>, TREATAS(…), …)<tail>`, one TREATAS
 * per filter. CALCULATETABLE intersects its filter arguments, so a slicer [A, B] and a click [A]
 * on the same column keep A. Duplicate values and identical filters are written once.
 */
export function injectCrossFilters(dax: string, filters: readonly CrossFilterValue[]): string {
  const args = new Map<string, string>();
  for (const f of filters) {
    const column = parseColumnRef(f.field);
    const values = f.values.filter((v, i) => f.values.indexOf(v) === i);
    if (values.length === 0) continue;
    const arg = treatAs(values, column);
    args.set(arg, arg);
  }
  if (args.size === 0) return dax;

  const { define, table, tail } = splitDaxQuery(dax);
  const filtered = call('CALCULATETABLE', [table, ...args.values()]);
  const head = define.trim() ? `${define.trimEnd()}\n` : '';
  return `${head}EVALUATE\n${filtered}${tail ? `\n${tail}` : ''}`;
}

/**
 * The default options query of a report filter: the column's values that have data, in order.
 * The column is validated and normalised (never interpolated as typed).
 */
export function columnValuesQuery(field: string): string {
  const column = parseColumnRef(field);
  return `EVALUATE\nSUMMARIZECOLUMNS(${column})\nORDER BY ${column}`;
}
