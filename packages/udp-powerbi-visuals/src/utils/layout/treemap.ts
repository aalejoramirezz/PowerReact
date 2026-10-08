import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { Categorised } from '../data';
import type { TooltipItem } from '../events';

/**
 * Treemap (FT "part-to-whole", hierarchical): area = a quantity, one or two levels (group → item).
 * Squarified tiles keep aspect ratios readable; parents get a header strip for their label. The
 * replacement for a donut beyond six parts, or when the parts nest.
 */

export interface TreemapNode extends Categorised {
  id: string;
  label: string;
  /** Leaf size (ignored on parents: they are the sum of their children). */
  value?: number | null;
  /** Optional second measure coloured on a ramp (e.g. condition, coverage). */
  colorValue?: number | null;
  children?: TreemapNode[];
  tooltips?: TooltipItem[];
}

export interface TreemapTile {
  node: TreemapNode;
  depth: number;
  /** Ids from the top, e.g. "Core/Buildings". */
  path: string;
  parent: TreemapNode | null;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  value: number;
  /** Share of the whole. */
  share: number;
  leaf: boolean;
}

/** Room above a parent's children for its label. */
export const HEADER = 20;

const size = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Tiles in drawing order (parents before their children), largest first within a parent. */
export function treemapLayout(nodes: readonly TreemapNode[], width: number, height: number, { gap = 2 }: { gap?: number } = {}): TreemapTile[] {
  const root = hierarchy<TreemapNode>({ id: '__root__', label: '', children: [...nodes] }, (d) => d.children)
    .sum((d) => (d.children?.length ? 0 : size(d.value)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const nested = nodes.some((n) => n.children?.length);
  treemap<TreemapNode>()
    .tile(treemapSquarify.ratio(1.3))
    .size([Math.max(1, width), Math.max(1, height)])
    .paddingInner(gap)
    .paddingTop((d) => (d.depth === 1 && nested && d.children ? HEADER : 0))
    .round(true)(root);
  const total = root.value ?? 0;
  return root
    .descendants()
    .filter((d) => d.depth > 0 && (d.value ?? 0) > 0)
    .map((d) => {
      const r = d as typeof d & { x0: number; y0: number; x1: number; y1: number };
      return {
        node: d.data,
        depth: d.depth - 1,
        path: d
          .ancestors()
          .reverse()
          .slice(1)
          .map((a) => a.data.id)
          .join('/'),
        parent: d.depth > 1 ? (d.parent?.data ?? null) : null,
        x0: r.x0,
        y0: r.y0,
        x1: r.x1,
        y1: r.y1,
        value: d.value ?? 0,
        share: total > 0 ? (d.value ?? 0) / total : 0,
        leaf: !d.children,
      };
    });
}
