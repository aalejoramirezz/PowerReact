import { h, type EventEmitter, type FunctionalComponent, type VNode } from '@stencil/core';
import type { ExportDetail, ExportFormat, FocusModeDetail, ThemeName, ViewChangeDetail, VisualView } from '../utils/events';
import { downloadBlob, safeFileName } from '../utils/export/download';
import { toCsv } from '../utils/export/csv';
import { toXlsx } from '../utils/export/xlsx';
import { UI_ICONS, type IconNode } from '../utils/icons';
import { columnsFromRows, type TableModel, type TableRow } from '../utils/table/model';
import { Icon } from './icon';
import { EmptyState, ErrorNote, LoadingState } from './states';

/* ─────────────────────────── state and contract ─────────────────────────── */

export interface FrameState {
  view: VisualView;
  focusOpen: boolean;
  curtainOpen: boolean;
  menuOpen: boolean;
}

export const INITIAL_FRAME: FrameState = { view: 'chart', focusOpen: false, curtainOpen: false, menuOpen: false };

export const CURTAIN_KICKER = 'What it means';

/**
 * What the shared frame needs from an element. Every visual implements it with the same public
 * props (heading, info, export…), its `@State() frame` and its three tooling events.
 */
export interface FrameHost {
  host: HTMLElement;
  frame: FrameState;
  visualId?: string;
  heading: string;
  subheading?: string;
  info?: string;
  calc?: string;
  loading: boolean;
  error?: string;
  stale: boolean;
  emptyMessage?: string;
  exportable: boolean;
  exportFormats: ExportFormat[];
  exportFileName?: string;
  exportRows?: TableRow[];
  focusable: boolean;
  index: number;
  theme?: ThemeName;
  exportData: EventEmitter<ExportDetail>;
  focusModeChange: EventEmitter<FocusModeDetail>;
  viewChange: EventEmitter<ViewChangeDetail>;
}

/* ─────────────────────────── actions ─────────────────────────── */

const root = (c: FrameHost) => c.host.shadowRoot;
const id = (c: FrameHost) => c.visualId ?? null;

export function setFrame(c: FrameHost, patch: Partial<FrameState>): void {
  c.frame = { ...c.frame, ...patch };
}

export function toggleView(c: FrameHost): void {
  const view: VisualView = c.frame.view === 'chart' ? 'table' : 'chart';
  setFrame(c, { view });
  c.viewChange.emit({ visualId: id(c), view });
}

export function toggleCurtain(c: FrameHost, open = !c.frame.curtainOpen): void {
  if (c.frame.curtainOpen !== open) setFrame(c, { curtainOpen: open });
}

/**
 * Opens the focus view: a native modal <dialog> in the top layer (it escapes the report plane's
 * backdrop-filter, traps focus and closes on Esc). The content renders into it on the next frame.
 */
export function openFocus(c: FrameHost): void {
  const dialog = root(c)?.querySelector<HTMLDialogElement>('dialog.u-dialog');
  if (!dialog || dialog.open) return;
  setFrame(c, { focusOpen: true, curtainOpen: false });
  dialog.showModal();
  c.focusModeChange.emit({ visualId: id(c), open: true });
}

export function closeFocus(c: FrameHost): void {
  root(c)?.querySelector<HTMLDialogElement>('dialog.u-dialog')?.close();
}

/** `close` event of the dialog (button, Esc or backdrop): back to the card, focus to its trigger. */
function onFocusClosed(c: FrameHost): void {
  if (!c.frame.focusOpen) return;
  setFrame(c, { focusOpen: false });
  c.focusModeChange.emit({ visualId: id(c), open: false });
  root(c)?.querySelector<HTMLElement>('[data-action="focus"]')?.focus();
}

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Client-side export (Blob + download link; nothing leaves the browser). It uses the raw query
 * rows when the container passes `exportRows`, otherwise the same model as the table view.
 */
export async function exportVisual(c: FrameHost, format: ExportFormat, model: TableModel): Promise<void> {
  const data: TableModel = c.exportRows?.length ? { columns: columnsFromRows(c.exportRows), rows: c.exportRows } : model;
  const fileName = `${safeFileName(c.exportFileName || c.heading || c.visualId || 'export')}.${format}`;
  const body = format === 'csv' ? toCsv(data.columns, data.rows) : await toXlsx(data.columns, data.rows, c.heading || 'Data');
  downloadBlob(new Blob([body], { type: MIME[format] }), fileName);
  c.exportData.emit({ visualId: id(c), format, fileName, rowCount: data.rows.length });
}

/* ─────────────────────────── action menu (popover) ─────────────────────────── */

export interface MenuItem {
  key: string;
  label: string;
  icon: IconNode;
  run: () => void;
}

const MENU_GAP = 6;

/** Places the top-layer menu under (or above) its trigger, aligned to the trigger's right edge. */
function placeMenu(menu: HTMLElement, trigger: HTMLElement): void {
  const r = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const estimated = menu.childElementCount * 34 + 16;
  const below = r.bottom + MENU_GAP + estimated <= vh || r.top < estimated + MENU_GAP;
  menu.dataset.placement = below ? 'bottom' : 'top';
  menu.style.top = below ? `${r.bottom + MENU_GAP}px` : 'auto';
  menu.style.bottom = below ? 'auto' : `${vh - r.top + MENU_GAP}px`;
  // Right-aligned with the trigger unless that would push the menu past the left edge
  if (r.right < 184) {
    menu.style.left = `${Math.max(8, r.left)}px`;
    menu.style.right = 'auto';
    menu.style.transformOrigin = below ? 'top left' : 'bottom left';
  } else {
    menu.style.right = `${Math.max(8, vw - r.right)}px`;
    menu.style.left = 'auto';
    menu.style.transformOrigin = '';
  }
}

function menuKeys(e: KeyboardEvent): void {
  const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const index = items.findIndex((el) => el.matches(':focus'));
  let next = -1;
  if (e.key === 'ArrowDown') next = (index + 1) % items.length;
  else if (e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  if (next >= 0) {
    e.preventDefault();
    items[next]?.focus();
  }
}

/**
 * A compact menu in a native popover (`popover="auto"`: top layer, light dismiss, Esc closes).
 * Arrow keys move between items; focus returns to the trigger when it closes.
 */
export const ActionMenu: FunctionalComponent<{
  c: FrameHost;
  menuId: string;
  label: string;
  icon: IconNode;
  items: MenuItem[];
  triggerClass?: string;
}> = ({ c, menuId, label, icon, items, triggerClass = 'u-icon-btn' }) => (
  <span class="u-menu-anchor">
    <button
      type="button"
      class={triggerClass}
      data-action={menuId}
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      aria-expanded={String(c.frame.menuOpen)}
      aria-controls={menuId}
      {...{ popovertarget: menuId }}
    >
      <Icon node={icon} size={16} />
    </button>
    <div
      id={menuId}
      class="u-menu"
      role="menu"
      aria-label={label}
      {...{ popover: 'auto' }}
      onBeforeToggle={(e: Event) => {
        const menu = e.currentTarget as HTMLElement;
        const trigger = root(c)?.querySelector<HTMLElement>(`[data-action="${menuId}"]`);
        if ((e as ToggleEvent).newState === 'open' && trigger) placeMenu(menu, trigger);
      }}
      onToggle={(e: Event) => {
        const open = (e as ToggleEvent).newState === 'open';
        setFrame(c, { menuOpen: open });
        const menu = e.currentTarget as HTMLElement;
        if (open) {
          menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        } else {
          const focused = root(c)?.activeElement;
          if (!focused || menu.contains(focused)) root(c)?.querySelector<HTMLElement>(`[data-action="${menuId}"]`)?.focus();
        }
      }}
      onKeyDown={menuKeys}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          class="u-menu__item"
          tabIndex={-1}
          onClick={(e: MouseEvent) => {
            ((e.currentTarget as HTMLElement).closest('.u-menu') as HTMLElement | null)?.hidePopover();
            item.run();
          }}
        >
          <Icon node={item.icon} size={15} strokeWidth={1.8} />
          {item.label}
        </button>
      ))}
    </div>
  </span>
);

export function exportItems(c: FrameHost, model: () => TableModel): MenuItem[] {
  const all: Record<ExportFormat, MenuItem> = {
    csv: { key: 'csv', label: 'Export CSV', icon: UI_ICONS.csv, run: () => void exportVisual(c, 'csv', model()) },
    xlsx: { key: 'xlsx', label: 'Export Excel', icon: UI_ICONS.xlsx, run: () => void exportVisual(c, 'xlsx', model()) },
  };
  return c.exportFormats.filter((f) => f in all).map((f) => all[f]);
}

/* ─────────────────────────── toolbar pieces ─────────────────────────── */

export const ViewToggle: FunctionalComponent<{ c: FrameHost }> = ({ c }) => (
  <button
    type="button"
    class="u-icon-btn"
    data-action="view"
    aria-label="Table view"
    aria-pressed={String(c.frame.view === 'table')}
    title={c.frame.view === 'table' ? 'Show the chart' : 'Show as a table'}
    onClick={() => toggleView(c)}
  >
    <Icon node={UI_ICONS.table} size={16} />
  </button>
);

export const FocusButton: FunctionalComponent<{ c: FrameHost }> = ({ c }) => (
  <button
    type="button"
    class="u-icon-btn"
    data-action="focus"
    aria-label="Focus view"
    title="Focus view"
    aria-haspopup="dialog"
    aria-expanded={String(c.frame.focusOpen)}
    onClick={() => openFocus(c)}
  >
    <Icon node={UI_ICONS.focus} size={15} />
  </button>
);

export const CurtainButton: FunctionalComponent<{ c: FrameHost }> = ({ c }) => (
  <button
    type="button"
    class="u-icon-btn"
    data-action="curtain"
    aria-expanded={String(c.frame.curtainOpen)}
    aria-controls="curtain"
    aria-label={c.frame.curtainOpen ? 'Hide what this chart means' : 'What this chart means'}
    title={CURTAIN_KICKER}
    onClick={() => toggleCurtain(c)}
  >
    <Icon node={UI_ICONS.info} size={16} />
  </button>
);

/**
 * Port of Lens `univerus_html._curtain`: an opaque panel that drops from the top edge of the card
 * with an accent hem. `open` undefined = hover / focus driven (KPI cards); boolean = ⓘ button.
 */
export const Curtain: FunctionalComponent<{
  info?: string;
  calc?: string;
  open?: boolean;
  onClose?: () => void;
  curtainId?: string;
  /** Defaults to the host card's padding (inherit). */
  padding?: string;
}> = ({ info, calc, open, onClose, curtainId = 'curtain', padding }) => {
  if (!info && !calc) return null;
  const controlled = open !== undefined;
  return (
    <div
      id={curtainId}
      class="u-curtain"
      style={padding ? { padding } : undefined}
      data-open={controlled ? String(open) : undefined}
      aria-hidden={String(controlled ? !open : true)}
      onClick={controlled && open ? onClose : undefined}
    >
      <p class="u-curtain__kicker">{CURTAIN_KICKER}</p>
      {info && <p class="u-curtain__info">{info}</p>}
      {calc && (
        <p class="u-curtain__calc">
          <b aria-hidden="true">ƒ</b>
          {calc}
        </p>
      )}
    </div>
  );
};

/** The focus view's <dialog>. Always in the tree (closed); its body renders only while open. */
export const FocusDialog: FunctionalComponent<{ c: FrameHost; toggle?: boolean; render: () => VNode | VNode[] | null }> = ({
  c,
  toggle = false,
  render,
}) => (
  <dialog
    class="u-dialog"
    aria-label={c.heading}
    onClose={() => onFocusClosed(c)}
    onClick={(e: MouseEvent) => {
      // A click on the dialog box itself (not its content) lands on the backdrop
      if (e.target === e.currentTarget) closeFocus(c);
    }}
  >
    <div class="u-dialog__head">
      <h2 class="u-dialog__title">{c.heading}</h2>
      <div class="u-toolbar">
        {toggle && <ViewToggle c={c} />}
        <button type="button" class="u-icon-btn" aria-label="Close focus view" title="Close (Esc)" autoFocus onClick={() => closeFocus(c)}>
          <Icon node={UI_ICONS.close} size={16} />
        </button>
      </div>
    </div>
    <div class="u-dialog__body">{c.frame.focusOpen ? render() : null}</div>
  </dialog>
);

/* ─────────────────────────── the frame ─────────────────────────── */

interface VisualFrameProps {
  c: FrameHost;
  /** Whether there is anything to draw (drives loading / empty / error states). */
  hasData: boolean;
  renderChart: () => VNode | VNode[] | null;
  /** Table view; omit to hide the Table toggle. */
  renderTable?: () => VNode;
  /** Model for the export when there is no table view. */
  model: () => TableModel;
  loadingRows?: number;
  /** The body draws its own loading / empty / error states (the data table keeps its header). */
  ownStates?: boolean;
}

/** Card body: the visual, or its loading / empty / error state with the final geometry. */
function frameContent({ c, hasData, renderChart, renderTable, loadingRows = 4, ownStates }: VisualFrameProps): VNode | VNode[] | null {
  if (ownStates) return renderChart();
  if (!hasData) {
    if (c.error) return <ErrorNote message={c.error} />;
    if (c.loading) return <LoadingState rows={loadingRows} />;
    return <EmptyState message={c.emptyMessage} />;
  }
  const main = c.frame.view === 'table' && renderTable ? renderTable() : renderChart();
  // Keep the last good data visible under the error (stale-while-error)
  return c.error ? [<ErrorNote key="error" message={c.error} />, ...(Array.isArray(main) ? main : [main])] : main;
}

/**
 * The standard card of every Univerus visual: header (title, subtitle, `aside` slot), the standard
 * toolbar (Export · Table · Focus · ⓘ), the body and the hover curtain. While the focus view is
 * open the card keeps its size and the visual renders in the dialog instead.
 */
export const VisualFrame: FunctionalComponent<VisualFrameProps> = (props) => {
  const { c, renderTable, model } = props;
  const hasCurtain = Boolean(c.info || c.calc);
  const items = c.exportable ? exportItems(c, model) : [];

  return (
    <section
      class="u-card u-card--pad u-card--frame"
      style={{ '--i': String(c.index) }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape' && c.frame.curtainOpen) toggleCurtain(c, false);
      }}
      onFocusout={(e: FocusEvent) => {
        const card = e.currentTarget as HTMLElement;
        if (c.frame.curtainOpen && !card.contains(e.relatedTarget as Node | null)) toggleCurtain(c, false);
      }}
    >
      <div class="u-card-head">
        <div class="u-card-head__text">
          <h3 class="u-card-title">{c.heading}</h3>
          {c.subheading && <p class="u-card-subtitle">{c.subheading}</p>}
        </div>
        <div class="u-card-head__tools">
          <slot name="aside" />
          <div class="u-toolbar">
            {items.length > 0 && <ActionMenu c={c} menuId="export-menu" label="Export data" icon={UI_ICONS.download} items={items} />}
            {renderTable && <ViewToggle c={c} />}
            {c.focusable && <FocusButton c={c} />}
            {hasCurtain && <CurtainButton c={c} />}
          </div>
        </div>
      </div>
      <div class="u-card-body" data-stale={String(c.stale)}>
        {c.frame.focusOpen ? <div class="u-focus-placeholder">Shown in the focus view</div> : frameContent(props)}
      </div>
      <slot name="footer" />
      {hasCurtain && <Curtain info={c.info} calc={c.calc} open={c.frame.curtainOpen} onClose={() => toggleCurtain(c, false)} />}
      {c.focusable && <FocusDialog c={c} toggle={Boolean(renderTable)} render={() => frameContent(props)} />}
    </section>
  );
};
