import { queryOptions } from '@tanstack/react-query';
import { errorMessage, getJson, postJson } from '../../api/http';
import { logEmbed } from '../../store/embedLog';
import type { PreconfiguredReport, ReportEmbedConfig } from '../../types';

export interface ReportSelection {
  code: string;
  workspaceId: string;
  reportId: string;
  pageName?: string;
}

/** Renew this long before the token expires. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;
const MIN_REFRESH_DELAY_MS = 30_000;

/** Delay until the embed token should be renewed, or false when the expiry is unknown. */
export function msUntilTokenRefresh(expiration: string | undefined, now = Date.now()): number | false {
  if (!expiration) return false;
  const expiresAt = Date.parse(expiration);
  if (Number.isNaN(expiresAt)) return false;
  return Math.max(MIN_REFRESH_DELAY_MS, expiresAt - now - TOKEN_REFRESH_MARGIN_MS);
}

export const preconfiguredReportsQuery = queryOptions({
  queryKey: ['preconfigured-reports'],
  queryFn: ({ signal }) => getJson<PreconfiguredReport[]>('/api/powerbi/preconfigured', signal),
  staleTime: Infinity,
});

/**
 * One cache entry per report: switching presets can never be overwritten by a slower,
 * older response. The entry refetches itself shortly before the token expires.
 */
export function embedConfigQuery({ workspaceId, reportId, pageName }: ReportSelection) {
  return queryOptions({
    queryKey: ['embed-config', workspaceId, reportId, pageName ?? null],
    queryFn: async ({ signal }) => {
      logEmbed(`Requesting Embed Token for Workspace: ${workspaceId}, Report: ${reportId}`);
      try {
        const config = await postJson<ReportEmbedConfig>(
          '/api/powerbi/embed-config',
          { workspaceId, reportId, pageName },
          signal
        );
        logEmbed(`Embed Token obtained (Type: ${config.tokenType}, Expires: ${config.expiration || 'unknown'})`);
        return config;
      } catch (error) {
        logEmbed(`ERROR: ${errorMessage(error)}`);
        throw error;
      }
    },
    // Renewal is driven by the token expiry, not by staleness
    staleTime: Infinity,
    refetchInterval: (query) => msUntilTokenRefresh(query.state.data?.expiration),
    refetchIntervalInBackground: true,
    // Never reuse a cached (possibly expired) token for a report that is shown again later
    gcTime: 0,
  });
}
