/**
 * Keyboard model for SVG charts (one tab stop per chart, WAI-ARIA "roving" pattern): the chart is
 * focusable, the arrow keys move an active mark (its tooltip shows), Enter / Space selects it and
 * Escape clears it. Lists move with any arrow; grids (heatmap, matrix, calendar) by row and column.
 */

export const ROVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * The next active index after a key press, or `undefined` when the key is not a navigation key.
 * `columns` = items per row for grids (default: one row holding everything).
 */
export function nextIndex(key: string, current: number | null, count: number, columns = count): number | undefined {
  if (!ROVING_KEYS.has(key) || count <= 0) return undefined;
  const cols = Math.max(1, Math.min(columns, count));
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (current === null) return key === 'ArrowLeft' || key === 'ArrowUp' ? count - 1 : 0;
  const grid = cols < count;
  switch (key) {
    case 'ArrowRight':
      return grid && (current % cols === cols - 1 || current === count - 1) ? current : Math.min(count - 1, current + 1);
    case 'ArrowLeft':
      return grid && current % cols === 0 ? current : Math.max(0, current - 1);
    case 'ArrowDown':
      return grid ? (current + cols < count ? current + cols : current) : Math.min(count - 1, current + 1);
    default:
      return grid ? (current - cols >= 0 ? current - cols : current) : Math.max(0, current - 1);
  }
}
