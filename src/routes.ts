export const ROUTES = {
  visuals: '/visuals',
  report: '/report',
  gallery: '/gallery',
  manifestPreview: '/manifest-preview',
} as const;

export type ViewId = keyof typeof ROUTES;

export const VIEW_LABELS: Record<ViewId, string> = {
  visuals: 'Asset Management',
  report: 'Report',
  gallery: 'Design Gallery',
  manifestPreview: 'Manifest Preview',
};

export function viewFromPath(pathname: string): ViewId | null {
  const match = (Object.keys(ROUTES) as ViewId[]).find(
    (view) => pathname === ROUTES[view] || pathname.startsWith(`${ROUTES[view]}/`)
  );
  return match ?? null;
}
