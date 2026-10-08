import { useQuery } from '@tanstack/react-query';
import { loadGeoAsset, type GeoAsset } from './geoAssets';

/** A boundary set, loaded once per session (boundaries never change while the app runs). */
export function useGeoAsset(set: string | undefined) {
  return useQuery<GeoAsset>({
    queryKey: ['geo', set],
    queryFn: ({ signal }) => loadGeoAsset(set as string, signal),
    enabled: Boolean(set),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
