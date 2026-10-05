import { useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Observed content size of an element. Charts draw SVG in real pixels (text never stretches), so they
 * need their container width; `fallback` is used before the first measurement (and in SSR tests).
 */
export function useElementSize<T extends HTMLElement>(fallback: ElementSize = { width: 640, height: 0 }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
