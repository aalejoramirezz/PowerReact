import { Build, h, type FunctionalComponent } from '@stencil/core';
import { geoGraticule10, type GeoPath, type GeoProjection } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import type { Feature, MultiLineString } from 'geojson';
import { Icon } from './icon';
import { UI_ICONS } from '../utils/icons';

/**
 * Shared pieces of the map elements: the quiet geography under the data (water or sphere, context
 * land, borders drawn once, graticule), an optional raster tile layer the host provides, the zoom
 * and globe-rotation controllers, the map buttons and the legends. Colours are `--pbi-map-*` roles.
 */

/** Pan / zoom state (d3-zoom transform): screen = translate + k × projected. */
export interface MapView {
  k: number;
  x: number;
  y: number;
}
export const IDENTITY_VIEW: MapView = { k: 1, x: 0, y: 0 };

/** A raster basemap the host provides (UDP: its Azure Maps key). Web Mercator tiles only. */
export interface MapTiles {
  /** URL template with {z}, {x}, {y}. */
  url: string;
  /** Credit shown on the map, as the provider requires. */
  attribution: string;
  maxZoom?: number;
}

/**
 * The view applied to a fitted projection: zoom scales around the frame, pan moves it. Flat maps
 * are clipped to the frame, so off-screen geography never reaches the path strings.
 */
export function applyView(projection: GeoProjection, view: MapView, globe: boolean, size?: [number, number]): GeoProjection {
  const [tx, ty] = projection.translate();
  if (globe) return view.k === 1 ? projection : projection.scale(projection.scale() * view.k);
  const zoomed = view.k === 1 && view.x === 0 && view.y === 0 ? projection : projection.scale(projection.scale() * view.k).translate([tx * view.k + view.x, ty * view.k + view.y]);
  return size ? zoomed.clipExtent([[-8, -8], [size[0] + 8, size[1] + 8]]) : zoomed;
}

/* ─────────────────────────── base layers ─────────────────────────── */

export const MapBase: FunctionalComponent<{
  path: GeoPath;
  globe: boolean;
  /** Draws the graticule (globe and world views). */
  graticule: boolean;
  width: number;
  height: number;
  /** Neighbouring land without data. */
  context: readonly Feature[];
  /** Land of the boundary set (point maps draw every region as land). */
  land: readonly Feature[];
  borders: { inner: MultiLineString | null; outer: MultiLineString | null };
  idPrefix: string;
  /** Draw the borders here (point maps), or leave them to the element (on top of choropleth fills). */
  withBorders?: boolean;
}> = ({ path, globe, graticule, width, height, context, land, borders, idPrefix, withBorders = true }) => (
  <g class="map-base" aria-hidden="true">
    <defs>
      <radialGradient id={`${idPrefix}-sphere`} cx="38%" cy="32%" r="75%">
        <stop offset="0%" class="map-sphere-hi" />
        <stop offset="100%" class="map-sphere-lo" />
      </radialGradient>
    </defs>
    {globe ? (
      <path d={path({ type: 'Sphere' }) ?? ''} class="map-sphere" style={{ fill: `url(#${idPrefix}-sphere)` }} />
    ) : (
      <rect x={0} y={0} width={width} height={height} class="map-water" />
    )}
    {graticule && <path d={path(geoGraticule10()) ?? ''} class="map-graticule" />}
    {context.map((f, i) => (
      <path key={`c${i}`} d={path(f) ?? ''} class="map-context" />
    ))}
    {land.map((f, i) => (
      <path key={`l${i}`} d={path(f) ?? ''} class="map-land" />
    ))}
    {withBorders && <MapBorders path={path} borders={borders} />}
    {globe && <path d={path({ type: 'Sphere' }) ?? ''} class="map-limb" />}
  </g>
);

export const MapBorders: FunctionalComponent<{ path: GeoPath; borders: { inner: MultiLineString | null; outer: MultiLineString | null } }> = ({ path, borders }) => (
  <g class="map-borders" aria-hidden="true">
    {borders.inner && <path d={path(borders.inner) ?? ''} class="map-border" />}
    {borders.outer && <path d={path(borders.outer) ?? ''} class="map-outline" />}
  </g>
);

/** Hatching for regions without data (pattern scoped to the element's shadow root). */
export const NoDataPattern: FunctionalComponent<{ id: string }> = ({ id }) => (
  <defs>
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" class="map-nodata" />
      <line x1="0" y1="0" x2="0" y2="6" class="map-hatch" />
    </pattern>
  </defs>
);

/* ─────────────────────────── raster tiles ─────────────────────────── */

export interface Tile {
  key: string;
  href: string;
  x: number;
  y: number;
  size: number;
}

/**
 * Web Mercator tiles covering the frame for a d3 `geoMercator` (unrotated): the world square is
 * 2π·scale pixels wide and centred on the projection's translate.
 */
export function mercatorTiles(projection: GeoProjection, width: number, height: number, tiles: MapTiles): Tile[] {
  const world = projection.scale() * 2 * Math.PI;
  const [tx, ty] = projection.translate();
  const left = tx - world / 2;
  const top = ty - world / 2;
  const z = Math.max(0, Math.min(tiles.maxZoom ?? 19, Math.round(Math.log2(world / 256))));
  const n = 2 ** z;
  const size = world / n;
  const out: Tile[] = [];
  const x0 = Math.floor(-left / size);
  const x1 = Math.ceil((width - left) / size);
  const y0 = Math.max(0, Math.floor(-top / size));
  const y1 = Math.min(n, Math.ceil((height - top) / size));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const wx = ((x % n) + n) % n;
      out.push({
        key: `${z}/${x}/${y}`,
        href: tiles.url.replace('{z}', String(z)).replace('{x}', String(wx)).replace('{y}', String(y)),
        x: left + x * size,
        y: top + y * size,
        size,
      });
    }
  }
  return out.length > 64 ? [] : out;
}

export const TileLayer: FunctionalComponent<{ tiles: Tile[] }> = ({ tiles }) => (
  <g class="map-tiles" aria-hidden="true">
    {tiles.map((t) => (
      <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.size + 0.5} height={t.size + 0.5} preserveAspectRatio="none" />
    ))}
  </g>
);

/* ─────────────────────────── interaction ─────────────────────────── */

const reducedMotion = () => Build.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pan and zoom with d3-zoom on the map's <svg>. The page keeps its scroll: the wheel zooms only with
 * Ctrl / ⌘ (and trackpad pinch, which browsers send as Ctrl + wheel); dragging pans only once zoomed
 * in, so a touch on an unzoomed map still scrolls the page. Buttons zoom by steps.
 */
export class MapZoom {
  private behavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private element: SVGSVGElement | null = null;
  private k = 1;

  constructor(
    private readonly onChange: (view: MapView) => void,
    private readonly options: { maxZoom?: number; pan?: () => boolean } = {}
  ) {}

  private get pan(): boolean {
    return this.options.pan?.() ?? true;
  }

  /** Pass as a Stencil `ref` of the <svg>. */
  readonly attach = (el?: SVGElement | null) => {
    const element = el as SVGSVGElement | null | undefined;
    if (!Build.isBrowser || !element || element === this.element) return;
    this.element = element;
    this.behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, this.options.maxZoom ?? 12])
      .filter((event: Event) => {
        if (event.type === 'wheel') return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
        if (event.type === 'dblclick') return true;
        if (!this.pan) return false;
        if (event.type === 'touchstart') return (event as TouchEvent).touches.length > 1 || this.k > 1;
        return !(event as MouseEvent).button && this.k > 1;
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = event.transform;
        this.k = t.k;
        element.dataset.zoomed = String(t.k > 1);
        this.onChange({ k: t.k, x: this.pan ? t.x : 0, y: this.pan ? t.y : 0 });
      });
    select(element).call(this.behavior);
    // The zoom state lives on the element: a new <svg> (e.g. the focus view) starts from the current view
    element.dataset.zoomed = String(this.k > 1);
  };

  zoomBy(factor: number): void {
    if (!this.behavior || !this.element) return;
    const sel = select(this.element);
    if (reducedMotion()) sel.call(this.behavior.scaleBy, factor);
    else sel.transition().duration(200).call(this.behavior.scaleBy, factor);
  }

  reset(): void {
    if (!this.behavior || !this.element) return;
    select(this.element).call(this.behavior.transform, zoomIdentity);
  }

  /** Zoom to `k` with the screen point (x, y) centred (hexbin drill-down). */
  zoomTo(x: number, y: number, k: number, width: number, height: number): void {
    if (!this.behavior || !this.element) return;
    const t = zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-x, -y);
    select(this.element).call(this.behavior.transform, t);
  }
}

/** Globe rotation by dragging (mouse and pen; touch only in the focus view, so the page scrolls). */
export class GlobeDrag {
  private start: { x: number; y: number; rotate: [number, number] } | null = null;

  constructor(
    private readonly get: () => [number, number],
    private readonly set: (rotate: [number, number]) => void,
    private readonly touch: () => boolean
  ) {}

  readonly down = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && !this.touch()) return;
    if (e.button !== 0) return;
    this.start = { x: e.clientX, y: e.clientY, rotate: this.get() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  readonly move = (e: PointerEvent) => {
    if (!this.start) return;
    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    const [l, p] = this.start.rotate;
    this.set([l + dx * 0.35, Math.max(-85, Math.min(85, p - dy * 0.35))]);
  };

  readonly up = (e: PointerEvent) => {
    if (!this.start) return;
    this.start = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
}

/** The map buttons: zoom in / out / reset, overlaid at the top right of the map. */
export const MapControls: FunctionalComponent<{ label: string; onZoom: (factor: number) => void; onReset: () => void; zoomed: boolean }> = ({ label, onZoom, onReset, zoomed }) => (
  <div class="map-controls" role="group" aria-label={`${label}: map controls`}>
    <button type="button" class="u-icon-btn map-btn" aria-label="Zoom in" onClick={() => onZoom(1.6)}>
      <span aria-hidden="true">+</span>
    </button>
    <button type="button" class="u-icon-btn map-btn" aria-label="Zoom out" onClick={() => onZoom(1 / 1.6)}>
      <span aria-hidden="true">−</span>
    </button>
    {zoomed && (
      <button type="button" class="u-icon-btn map-btn" aria-label="Reset view" onClick={onReset}>
        <Icon node={UI_ICONS.close} size={14} />
      </button>
    )}
  </div>
);

/* ─────────────────────────── legends ─────────────────────────── */

export interface ClassSwatch {
  label: string;
  fill: string;
}

/** Ordered colour classes (low → high) with an optional "No data" swatch. */
export const ClassLegend: FunctionalComponent<{ items: readonly ClassSwatch[]; noData?: string; label?: string; hatchId?: string }> = ({ items, noData, label = 'Legend', hatchId }) => (
  <ul class="u-legend map-legend" aria-label={label}>
    {items.map((it) => (
      <li key={it.label}>
        <i style={{ background: it.fill }} aria-hidden="true" />
        {it.label}
      </li>
    ))}
    {noData && (
      <li class="map-legend__nodata">
        <svg width="12" height="12" aria-hidden="true">
          <rect width="12" height="12" rx="2" style={{ fill: hatchId ? `url(#${hatchId})` : 'var(--pbi-map-nodata)' }} />
        </svg>
        {noData}
      </li>
    )}
  </ul>
);

/** A sequential ramp between two words ("Fewer" … "More"), for density marks. */
export const RampLegend: FunctionalComponent<{ low: string; high: string; steps?: number[]; label?: string }> = ({ low, high, steps = [1, 2, 3, 4, 5, 6, 7], label = 'Legend' }) => (
  <p class="map-ramp" aria-label={`${label}: from ${low} to ${high}`}>
    <span>{low}</span>
    {steps.map((k) => (
      <i key={k} style={{ background: `var(--pbi-seq-${k})` }} aria-hidden="true" />
    ))}
    <span>{high}</span>
  </p>
);

/** Proportional symbols: nested circles (bubbles) or spikes for three reference values. */
export const SizeLegend: FunctionalComponent<{ values: readonly { value: number; size: number; label: string }[]; mark: 'bubble' | 'spike'; title: string }> = ({ values, mark, title }) => {
  if (!values.length) return null;
  const max = Math.max(...values.map((v) => v.size));
  // Spikes stand side by side, spaced by their widest label
  const step = Math.max(34, Math.max(...values.map((v) => v.label.length)) * 6.4 + 10);
  const w = mark === 'bubble' ? max * 2 + 70 : values.length * step + 10;
  const tall = mark === 'bubble' ? max * 2 + 4 : max + 18;
  // Bubble labels sit at each circle's top, pushed apart so small circles never stack their text
  const labelY: number[] = [];
  values.forEach((v, i) => {
    const y = tall - 2 - v.size * 2 + 4;
    labelY.push(i === 0 ? y : Math.max(y, (labelY[i - 1] as number) + 11));
  });
  return (
    <figure class="map-size-legend" aria-label={`${title}: ${values.map((v) => v.label).join(', ')}`}>
      <svg width={w} height={mark === 'bubble' ? Math.max(tall, (labelY[labelY.length - 1] ?? 0) + 3) : tall} aria-hidden="true">
        {mark === 'bubble'
          ? values.map((v) => [
              <circle key={`c${v.value}`} cx={max} cy={tall - 2 - v.size} r={v.size} class="map-size-legend__mark" />,
              <line key={`l${v.value}`} x1={max} x2={max * 2 + 8} y1={tall - 2 - v.size * 2} y2={tall - 2 - v.size * 2} class="map-size-legend__tick" />,
              <text key={`t${v.value}`} x={max * 2 + 12} y={labelY[values.indexOf(v)]} class="map-size-legend__text">
                {v.label}
              </text>,
            ])
          : values.map((v, i) => [
              <path key={`s${v.value}`} d={`M${i * step + step / 2 - 3},${tall - 14}L${i * step + step / 2},${tall - 14 - v.size}L${i * step + step / 2 + 3},${tall - 14}Z`} class="map-size-legend__spike" />,
              <text key={`t${v.value}`} x={i * step + step / 2} y={tall - 2} text-anchor="middle" class="map-size-legend__text">
                {v.label}
              </text>,
            ])}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
};
