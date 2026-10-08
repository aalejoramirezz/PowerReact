import { h, type EventEmitter, type FunctionalComponent, type VNode } from '@stencil/core';
import { slug } from '../utils/data';
import type { DataPointClickDetail } from '../utils/events';
import { formatValue, type FormatSpec } from '../utils/formats';
import { isKpiIconName, KPI_ICONS, UI_ICONS } from '../utils/icons';
import type { TableModel } from '../utils/table/model';
import { ActionMenu, Curtain, exportItems, FocusDialog, openFocus, type FrameHost, type MenuItem } from './frame';
import { Icon } from './icon';

/**
 * The shell every KPI element shares (styles/kpi.css): the card, its body (a full-card button when
 * the KPI is interactive), the touch ⓘ and the curtain, the ⋯ menu (export, focus view) and the
 * focus dialog. Sibling buttons, never nested ones. Each KPI renders only its own content inside.
 * Test ids: `kpi-<label-slug>` on the number, `kpi-card-<label-slug>` on the card.
 */

/** What a KPI element exposes to the shell: the frame host plus its toggle props. */
export interface KpiHost extends FrameHost {
  crossFilterField?: string;
  /** The card is a button that emits `dataPointClick` (default: when `active` or `crossFilterField` is set). */
  interactive?: boolean;
  /** Toggle state; undefined for a plain action (no pressed state, no selection ring). */
  active?: boolean;
  /** The touch ⓘ has opened the curtain. */
  touchOpen: boolean;
  dataPointClick: EventEmitter<DataPointClickDetail>;
}

export interface KpiDelta {
  text: string;
  /** Colour follows business meaning (favourable / unfavourable), never the sign alone. */
  favourable: boolean;
}

const PCT1: FormatSpec = { style: 'percent', decimals: 1 };

/** Relative change of `value` against `comparison`, judged by `goodWhen` ("↑ 3.1% vs PY"). */
export function derivedDelta(value: number | null | undefined, comparison: number | null | undefined, goodWhen: 'higher' | 'lower', label?: string): KpiDelta | null {
  if (value === null || value === undefined || comparison === null || comparison === undefined || comparison === 0) return null;
  const change = (value - comparison) / Math.abs(comparison);
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const favourable = goodWhen === 'higher' ? change >= 0 : change <= 0;
  return { text: `${arrow} ${formatValue(Math.abs(change), PCT1)}${label ? ` ${label}` : ''}`, favourable };
}

/** The number as text: ready text wins; "…" while the first value loads; "—" when blank or failed. */
export function kpiValueText(c: { displayValue?: string; value?: number | null; loading: boolean; error?: string; format?: FormatSpec }): string {
  if (c.displayValue !== undefined && c.displayValue !== null) return c.displayValue;
  if (c.value === null || c.value === undefined) return c.loading && !c.error ? '…' : '—';
  return formatValue(c.value, c.format);
}

export const kpiInteractive = (c: Pick<KpiHost, 'interactive' | 'active' | 'crossFilterField'>): boolean =>
  c.interactive ?? (c.active !== undefined || Boolean(c.crossFilterField));

/** Label and icon mark (or the `icon` slot). */
export const KpiTop: FunctionalComponent<{ heading: string; icon?: string }> = ({ heading, icon }) => {
  const node = isKpiIconName(icon) ? KPI_ICONS[icon] : null;
  return (
    <div class="kpi-top">
      <span class="kpi-label">{heading}</span>
      <slot name="icon">
        {node && (
          <span class="kpi-mark" aria-hidden="true">
            <Icon node={node} size={16} strokeWidth={1.8} />
          </span>
        )}
      </slot>
    </div>
  );
};

/** The delta chip text, coloured by meaning. */
export const KpiDeltaText: FunctionalComponent<{ delta: KpiDelta | null }> = ({ delta }) =>
  delta ? (
    <span class="kpi-delta" data-favourable={String(delta.favourable)}>
      {delta.text}
    </span>
  ) : null;

/** Focus view: the label, the KPI's own large content, then what it means and how it is calculated. */
export const KpiFocus: FunctionalComponent<{ heading: string; info?: string; calc?: string }> = ({ heading, info, calc }, children) => (
  <div class="kpi-focus">
    <p class="kpi-focus__label">{heading}</p>
    {children}
    {info && <p class="kpi-focus__info">{info}</p>}
    {calc && (
      <p class="kpi-focus__calc">
        <b aria-hidden="true">ƒ</b>
        {calc}
      </p>
    )}
  </div>
);

export const KpiShell: FunctionalComponent<{
  c: KpiHost;
  /** Extra class on the card, e.g. "kpi--trend". */
  variant?: string;
  model: () => TableModel;
  renderFocus: () => VNode | VNode[] | null;
  onTouch: (open: boolean) => void;
}> = ({ c, variant, model, renderFocus, onTouch }, children) => {
  const id = slug(c.heading);
  const hasCurtain = Boolean(c.info || c.calc);
  const interactive = kpiInteractive(c);
  const items: MenuItem[] = [
    ...(c.exportable ? exportItems(c, model) : []),
    ...(c.focusable ? [{ key: 'focus', label: 'Focus view', icon: UI_ICONS.focus, run: () => openFocus(c) }] : []),
  ];
  const activate = () =>
    c.dataPointClick.emit({ visualId: c.visualId ?? null, field: c.crossFilterField ?? null, value: c.visualId ?? c.heading, label: c.heading });
  return (
    <div
      class={{
        'u-card': true,
        'u-curtain-host': true,
        kpi: true,
        ...(variant ? { [variant]: true } : {}),
        'kpi--curtain': hasCurtain,
        'kpi--actions': items.length > 0,
        'u-card--interactive': interactive,
        'u-card--active': c.active === true,
      }}
      style={{ '--i': String(c.index) }}
      data-testid={`kpi-card-${id}`}
    >
      {interactive ? (
        <button
          type="button"
          class="kpi-body"
          aria-pressed={c.active === undefined ? undefined : String(c.active)}
          aria-describedby={hasCurtain ? 'curtain' : undefined}
          onClick={activate}
        >
          {children}
        </button>
      ) : (
        // Focusable so keyboard users can reveal the curtain too
        <div class="kpi-body" tabIndex={hasCurtain ? 0 : undefined} aria-describedby={hasCurtain ? 'curtain' : undefined}>
          {children}
        </div>
      )}

      {hasCurtain && (
        <button
          type="button"
          class="u-icon-btn kpi-info"
          aria-expanded={String(c.touchOpen)}
          aria-controls="curtain"
          aria-label={c.touchOpen ? `Hide what ${c.heading} means` : `What ${c.heading} means`}
          onClick={() => onTouch(!c.touchOpen)}
        >
          <Icon node={UI_ICONS.info} size={16} />
        </button>
      )}
      {hasCurtain && <Curtain info={c.info} calc={c.calc} open={c.touchOpen} onClose={() => onTouch(false)} padding="var(--pbi-kpi-pad)" />}

      {items.length > 0 && (
        <div class="kpi-actions">
          <ActionMenu c={c} menuId="kpi-menu" label={`More options for ${c.heading}`} icon={UI_ICONS.more} items={items} />
        </div>
      )}
      {c.focusable && <FocusDialog c={c} toggle render={renderFocus} />}
    </div>
  );
};
