export const ROUTES = {
  visuals: '/visuals',
  report: '/report',
} as const;

export type ViewId = keyof typeof ROUTES;

export const VIEW_LABELS: Record<ViewId, string> = {
  visuals: 'Asset Management',
  report: 'Report',
};

export function viewFromPath(pathname: string): ViewId | null {
  const match = (Object.keys(ROUTES) as ViewId[]).find(
    (view) => pathname === ROUTES[view] || pathname.startsWith(`${ROUTES[view]}/`)
  );
  return match ?? null;
}
