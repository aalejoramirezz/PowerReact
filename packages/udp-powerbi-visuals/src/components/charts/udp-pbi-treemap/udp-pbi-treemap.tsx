import { Component, Element, Event, h, Host, Prop, State, type EventEmitter } from '@stencil/core';
import { ChartTooltip, tooltipRows, type TooltipRow } from '../../../functional/chart-kit';
import { INITIAL_FRAME, VisualFrame, type FrameState, type VisualFrameMode } from '../../../functional/frame';
import { chartLabel, clickValue } from '../../../utils/data';
import {
  sameValue,
  type DataPointClickDetail,
  type DataPointFilter,
  type DataPointValue,
  type ExportDetail,
  type ExportFormat,
  type FocusModeDetail,
  type ThemeName,
  type ViewChangeDetail,
} from '../../../utils/events';
import { formatter, type FormatSpec } from '../../../utils/formats';
import { clipLabel, divergingStep, extent, sequentialStep } from '../../../utils/layout/scales';
import { HEADER, treemapLayout, type TreemapNode, type TreemapTile } from '../../../utils/layout/treemap';
import { rampColour, type SeriesColour } from '../../../utils/palette';
import { nextIndex } from '../../../utils/roving';
import { ROW_KEY } from '../../../utils/table/builders';
import type { TableModel, TableRow } from '../../../utils/table/model';
import { WidthObserver } from '../../../utils/width-observer';

const PERCENT: FormatSpec = { style: 'percent', decimals: 1 };
/** Groups take distinct, contrast-checked steps of the sequential ramp (tonal before new hues). */
const GROUP_STEPS = [5, 3, 6, 4, 7, 2];

/**
 * Treemap (FT "part-to-whole", hierarchical): how a total splits into nested parts — area is the
 * quantity, one or two levels (group → item). Squarified tiles, group headers, labels where they
 * fit; colour is a second measure on a token ramp (sequential, or diverging by meaning) or, without
 * one, a tonal step per group. The alternative to a donut beyond six parts. Hover or the arrow keys
 * show the tooltip (path, value, share); a click (Enter / Space) on an item reports its group and
 * item, on a header its group.
 */
@Component({
  tag: 'udp-pbi-treemap',
  styleUrls: ['../../../styles/tokens-bridge.css', '../../../styles/motion.css', '../../../styles/shadow.css', '../../../styles/surfaces.css', 'udp-pbi-treemap.css'],
  shadow: true,
})
export class UdpPbiTreemap {
  @Element() host!: HTMLElement;

  /** Identifies the visual in its events. */
  @Prop() visualId?: string;
  /** Card title (`title` is a global HTML attribute, hence `heading`). */
  @Prop() heading = '';
  @Prop() subheading?: string;
  /** Accessible name of the chart; defaults to the heading. */
  @Prop() label?: string;
  /** Curtain: what the chart means, one sentence. */
  @Prop() info?: string;
  /** Curtain: how it is calculated, one line. */
  @Prop() calc?: string;
  /** Format of the sizes. */
  @Prop() format?: FormatSpec;
  @Prop() loading = false;
  @Prop() error?: string;
  /** Previous filters' data shown (dimmed) while the new query runs. */
  @Prop() stale = false;
  @Prop() emptyMessage?: string;
  /** The selected item or group (raw value or id): the others dim. */
  @Prop() selectedValue?: DataPointValue | null;
  /** Column reference of the top level (shorthand for `levelFields[0]`). */
  @Prop() crossFilterField?: string;
  /** Column reference per level, top first: a click filters each level it belongs to. */
  @Prop() levelFields: string[] = [];
  /** Clicks emit `dataPointClick` (default: when a field is set). */
  @Prop() interactive?: boolean;
  @Prop() exportable = true;
  @Prop() exportFormats: ExportFormat[] = ['csv', 'xlsx'];
  @Prop() exportFileName?: string;
  /** Raw query rows to export instead of the visual's table. */
  @Prop() exportRows?: TableRow[];
  @Prop() focusable = true;
  @Prop() tableToggle = true;
  /** Pins this element to a template regardless of <html data-theme>. */
  @Prop() theme?: ThemeName;
  /**
   * card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone,
   * to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged.
   */
  @Prop() frame: VisualFrameMode = 'card';
  @Prop() testIdPrefix?: string;
  /** Entrance stagger position. */
  @Prop() index = 0;
  @Prop() loadingRows = 5;

  /** Top-level parts, each optionally with `children` (two levels at most). */
  @Prop() nodes: TreemapNode[] = [];
  /** What the colour measures (tooltip, legend, table) when items carry `colorValue`. */
  @Prop() colorLabel?: string;
  @Prop() colorFormat?: FormatSpec;
  /** The colour ramp: sequential (low → high) or diverging around `colorCenter`. */
  @Prop() colorScale: 'sequential' | 'diverging' = 'sequential';
  /** diverging: the favourable side. */
  @Prop() goodWhen: 'higher' | 'lower' = 'higher';
  /** diverging: the reference value. */
  @Prop() colorCenter = 0;
  /** Headers of the levels in the table view and the export, top first. */
  @Prop() levelLabels: string[] = [];
  /** Plot height in px. */
  @Prop() chartHeight = 320;

  @State() ui: FrameState = INITIAL_FRAME;
  @State() width = 640;
  /** Index into the tiles in keyboard order. */
  @State() active: number | null = null;

  @Event({ composed: true }) dataPointClick!: EventEmitter<DataPointClickDetail>;
  @Event({ composed: true }) exportData!: EventEmitter<ExportDetail>;
  @Event({ composed: true }) focusModeChange!: EventEmitter<FocusModeDetail>;
  @Event({ composed: true }) viewChange!: EventEmitter<ViewChangeDetail>;

  private sizer = new WidthObserver((w) => {
    if (w > 0 && w !== this.width) this.width = w;
  });

  disconnectedCallback(): void {
    this.sizer.disconnect();
  }

  private get fields(): string[] {
    return this.levelFields.length ? this.levelFields : this.crossFilterField ? [this.crossFilterField] : [];
  }

  private get isInteractive(): boolean {
    return this.interactive ?? this.fields.length > 0;
  }

  private model = (): TableModel => {
    const nested = this.nodes.some((n) => n.children?.length);
    const hasColor = this.nodes.some((n) => n.colorValue !== undefined || n.children?.some((c) => c.colorValue !== undefined));
    const leaves = nested ? this.nodes.flatMap((g) => (g.children?.length ? g.children.map((c) => ({ group: g, item: c })) : [{ group: g, item: g }])) : this.nodes.map((n) => ({ group: null, item: n }));
    const total = leaves.reduce((t, l) => t + Math.max(0, l.item.value ?? 0), 0);
    return {
      columns: [
        ...(nested ? [{ key: 'group', label: this.levelLabels[0] ?? 'Group' }] : []),
        { key: 'item', label: this.levelLabels[nested ? 1 : 0] ?? 'Item' },
        { key: 'value', label: 'Value', kind: 'number', format: this.format },
        { key: 'share', label: 'Share', kind: 'number', format: PERCENT },
        ...(hasColor ? [{ key: 'color', label: this.colorLabel ?? 'Colour', kind: 'number' as const, format: this.colorFormat }] : []),
      ],
      rows: leaves.map(({ group, item }) => ({
        [ROW_KEY]: clickValue(item),
        ...(nested ? { group: group?.label ?? null } : {}),
        item: item.label,
        value: item.value ?? null,
        share: total > 0 ? Math.max(0, item.value ?? 0) / total : null,
        ...(hasColor ? { color: item.colorValue ?? null } : {}),
      })),
    };
  };

  /** Reports a tile: an item reports its group and itself, a header its group. */
  private pick(tile: TreemapTile): void {
    if (!this.isInteractive) return;
    const chain = tile.parent ? [tile.parent, tile.node] : [tile.node];
    const filters: DataPointFilter[] = chain.flatMap((n, depth) => {
      const field = this.fields[depth];
      return field ? [{ field, value: clickValue(n), label: n.label }] : [];
    });
    if (!filters.length) return;
    const last = filters[filters.length - 1] as DataPointFilter;
    this.dataPointClick.emit({ visualId: this.visualId ?? null, field: last.field, value: last.value, label: chain.map((n) => n.label).join(' › '), filters });
  }

  private colours(tiles: TreemapTile[]): (tile: TreemapTile) => SeriesColour {
    const leaves = tiles.filter((t) => t.leaf);
    const values = leaves.map((t) => t.node.colorValue).filter((v): v is number => typeof v === 'number');
    const groups = [...new Set(tiles.filter((t) => t.depth === 0).map((t) => t.node.id))];
    if (values.length) {
      const range = extent(values) ?? [0, 1];
      const maxDistance = Math.max(Math.abs(range[0] - this.colorCenter), Math.abs(range[1] - this.colorCenter));
      return (t) => {
        const v = t.node.colorValue;
        const step =
          this.colorScale === 'diverging'
            ? divergingStep(v, { center: this.colorCenter, maxDistance, goodWhen: this.goodWhen })
            : sequentialStep(v, range);
        return step ? rampColour(step, this.colorScale) : { fill: 'var(--pbi-track)', text: 'var(--pbi-text-soft)' };
      };
    }
    return (t) => {
      const group = t.parent ?? t.node;
      return rampColour(GROUP_STEPS[groups.indexOf(group.id) % GROUP_STEPS.length] ?? 5, 'sequential');
    };
  }

  private onKeyDown(e: KeyboardEvent, order: TreemapTile[]): void {
    if (e.key === 'Escape' && this.active !== null) {
      e.preventDefault();
      this.active = null;
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.active !== null) {
      e.preventDefault();
      const tile = order[this.active];
      if (tile) this.pick(tile);
      return;
    }
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const next = nextIndex(map[e.key] ?? e.key, this.active, order.length);
    if (next === undefined) return;
    e.preventDefault();
    this.active = next;
  }

  private renderChart = () => {
    const height = this.chartHeight;
    const tiles = treemapLayout(this.nodes, this.width, height);
    // Keyboard order: every item, largest first; a single-level map has only items
    const order = tiles.filter((t) => t.leaf).sort((a, b) => b.value - a.value);
    const colour = this.colours(tiles);
    const fmt = formatter(this.format);
    const pct = formatter(PERCENT);
    const cfmt = formatter(this.colorFormat);
    const interactive = this.isInteractive;
    const active = this.active !== null && this.active < order.length ? order[this.active] : undefined;
    const hasSelection = this.selectedValue !== null && this.selectedValue !== undefined;
    const isSelected = (t: TreemapTile) => sameValue(clickValue(t.node), this.selectedValue) || (t.parent !== null && sameValue(clickValue(t.parent), this.selectedValue));
    const p = this.testIdPrefix;

    let tooltip: { x: number; y: number; title: string; rows: TooltipRow[] } | null = null;
    if (active) {
      const rows: TooltipRow[] = [
        { label: 'Value', value: fmt(active.value) },
        { label: 'Share of total', value: pct(active.share) },
        ...(typeof active.node.colorValue === 'number' ? [{ label: this.colorLabel ?? 'Colour', value: cfmt(active.node.colorValue) }] : []),
        ...tooltipRows(active.node.tooltips),
      ];
      tooltip = {
        x: Math.min(Math.max((active.x0 + active.x1) / 2, 80), this.width - 80),
        y: active.y0 + 6,
        title: active.parent ? `${active.parent.label} › ${active.node.label}` : active.node.label,
        rows,
      };
    }

    return (
      <div class="tm" style={{ height: `${height}px` }} ref={this.sizer.observe}>
        <svg
          class="u-chart-svg"
          width={this.width}
          height={height}
          role="img"
          aria-label={chartLabel(this)}
          tabindex={0}
          onMouseLeave={() => (this.active = null)}
          onBlur={() => (this.active = null)}
          onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e, order)}
        >
          {tiles.map((t, k) => {
            const w = t.x1 - t.x0;
            const hgt = t.y1 - t.y0;
            const dimmed = hasSelection && !isSelected(t);
            if (!t.leaf) {
              // A group: its header strip carries the label and total
              return (
                <g key={t.path} class="tm-group">
                  <rect x={t.x0} y={t.y0} width={w} height={hgt} rx={6} class="tm-group__bg" />
                  <text
                    x={t.x0 + 8}
                    y={t.y0 + HEADER - 6}
                    class={{ 'tm-group__label': true, 'tm-clickable': interactive }}
                    data-dimmed={String(dimmed)}
                    data-testid={p ? `${p}-group-${t.node.id}` : undefined}
                    onClick={() => this.pick(t)}
                  >
                    {clipLabel(`${t.node.label} · ${fmt(t.value)}`, Math.max(3, Math.floor((w - 12) / 6.6)))}
                  </text>
                </g>
              );
            }
            const c = colour(t);
            const fits = w >= 56 && hgt >= 30;
            const chars = Math.max(2, Math.floor((w - 12) / 6.6));
            return (
              <g key={t.path} class="tm-tile" style={{ animationDelay: `${200 + Math.min(k, 24) * 25}ms` }}>
                <rect
                  class={{ 'u-mark': true, 'u-mark-active': active === t }}
                  x={t.x0}
                  y={t.y0}
                  width={Math.max(0, w)}
                  height={Math.max(0, hgt)}
                  rx={3}
                  style={{ fill: c.fill }}
                  data-dimmed={String(dimmed)}
                  data-interactive={String(interactive)}
                  data-testid={p ? `${p}-tile-${t.path}` : undefined}
                  onMouseEnter={() => (this.active = order.indexOf(t))}
                  onClick={() => this.pick(t)}
                />
                {fits && (
                  <text x={t.x0 + 6} y={t.y0 + 15} class="tm-label" style={{ fill: c.text }} data-dimmed={String(dimmed)} aria-hidden="true">
                    {clipLabel(t.node.label, chars)}
                  </text>
                )}
                {fits && hgt >= 44 && (
                  <text x={t.x0 + 6} y={t.y0 + 30} class="tm-value" style={{ fill: c.text }} data-dimmed={String(dimmed)} aria-hidden="true">
                    {clipLabel(fmt(t.value), chars)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {tooltip && <ChartTooltip x={tooltip.x} y={tooltip.y} title={tooltip.title} rows={tooltip.rows} />}
      </div>
    );
  };

  private renderTable = () => {
    const m = this.model();
    const leafField = this.fields[this.nodes.some((n) => n.children?.length) ? 1 : 0];
    return (
      <udp-pbi-data-table
        frame="none"
        visualId={this.visualId}
        label={`${chartLabel(this)} (table)`}
        columns={m.columns}
        rows={m.rows}
        rowKey={ROW_KEY}
        selectedValue={this.selectedValue}
        crossFilterField={leafField}
        interactive={Boolean(leafField) && (this.interactive ?? true)}
      />
    );
  };

  render() {
    return (
      <Host data-theme={this.theme}>
        <VisualFrame
          c={this}
          hasData={this.nodes.length > 0}
          renderChart={this.renderChart}
          renderTable={this.tableToggle ? this.renderTable : undefined}
          model={this.model}
          loadingRows={this.loadingRows}
        />
      </Host>
    );
  }
}
