/**
 * Observed width of the element a chart draws into. Charts draw SVG in real pixels (text never
 * stretches), so they need their container's width — the card body, or the focus dialog when the
 * chart moves there. Pass `observe` as a Stencil `ref`; a new element replaces the previous one.
 */
export class WidthObserver {
  private element: Element | null = null;
  private observer: ResizeObserver | null = null;

  constructor(private readonly onWidth: (width: number) => void) {}

  readonly observe = (element?: Element | null) => {
    if (!element || element === this.element) return;
    this.disconnect();
    this.element = element;
    if (typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver(([entry]) => {
      if (entry) this.onWidth(Math.round(entry.contentRect.width));
    });
    this.observer.observe(element);
  };

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.element = null;
  }
}
