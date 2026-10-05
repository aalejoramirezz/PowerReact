import axios from 'axios';
import { SCOPES, type TokenCache } from '../auth/tokenCache.js';
import type { ServicePrincipalCredentials } from '../config.js';

const API = 'https://api.powerbi.com/v1.0/myorg';

interface PowerBiReport {
  id: string;
  name: string;
  embedUrl: string;
  datasetId?: string;
  webUrl?: string;
  reportType?: string;
}

interface GenerateTokenResponse {
  token: string;
  expiration: string;
}

export type DaxRow = Record<string, unknown>;

interface ExecuteQueriesResponse {
  results?: Array<{ tables?: Array<{ rows?: DaxRow[] }> }>;
}

export interface EmbedConfig {
  success: true;
  reportId: string;
  reportName: string;
  embedUrl: string;
  datasetId?: string;
  accessToken: string;
  tokenType: 'Embed' | 'Aad';
  isPaginated: boolean;
  /** ISO timestamp; the client schedules token renewal from it. */
  expiration: string;
  webUrl?: string;
  pageName?: string;
}

export interface DaxQueryResult {
  success: true;
  executionTimeMs: number;
  rowCount: number;
  rows: DaxRow[];
  rawResults: NonNullable<ExecuteQueriesResponse['results']>;
}

const bearer = (token: string) => ({
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
});

/**
 * Tries the report-scoped GenerateToken (V1) and then the multi-resource V2 endpoint.
 * Returns null when neither works (e.g. workspace not on a dedicated capacity).
 */
async function generateEmbedToken(
  aadToken: string,
  workspaceId: string,
  report: PowerBiReport
): Promise<GenerateTokenResponse | null> {
  try {
    const res = await axios.post<GenerateTokenResponse>(
      `${API}/groups/${workspaceId}/reports/${report.id}/GenerateToken`,
      { accessLevel: 'View' },
      bearer(aadToken)
    );
    return res.data;
  } catch {
    try {
      const res = await axios.post<GenerateTokenResponse>(
        `${API}/GenerateToken`,
        {
          reports: [{ id: report.id }],
          targetWorkspaces: [{ id: workspaceId }],
          ...(report.datasetId ? { datasets: [{ id: report.datasetId }] } : {}),
        },
        bearer(aadToken)
      );
      return res.data;
    } catch (v2Error) {
      const details = axios.isAxiosError(v2Error) ? (v2Error.response?.data ?? v2Error.message) : v2Error;
      console.warn('Embed token generation failed; falling back to AAD token.', details);
      return null;
    }
  }
}

export async function getEmbedConfig(
  tokens: TokenCache,
  credentials: ServicePrincipalCredentials,
  target: { workspaceId: string; reportId: string; pageName?: string }
): Promise<EmbedConfig> {
  const aad = await tokens.getToken(SCOPES.powerBi, credentials);

  const { data: report } = await axios.get<PowerBiReport>(
    `${API}/groups/${target.workspaceId}/reports/${target.reportId}`,
    bearer(aad.token)
  );

  const isPaginated = report.reportType === 'PaginatedReport' || Boolean(report.embedUrl?.includes('rdlEmbed'));
  const embedToken = await generateEmbedToken(aad.token, target.workspaceId, report);

  return {
    success: true,
    reportId: report.id,
    reportName: report.name,
    embedUrl: report.embedUrl,
    datasetId: report.datasetId,
    accessToken: embedToken?.token ?? aad.token,
    tokenType: embedToken ? 'Embed' : 'Aad',
    isPaginated,
    expiration: embedToken?.expiration ?? new Date(aad.expiresAt).toISOString(),
    webUrl: report.webUrl,
    pageName: target.pageName,
  };
}

export async function executeDaxQuery(
  tokens: TokenCache,
  credentials: ServicePrincipalCredentials,
  target: { workspaceId: string; datasetId: string; query: string }
): Promise<DaxQueryResult> {
  const startedAt = Date.now();
  const aad = await tokens.getToken(SCOPES.powerBi, credentials);

  const response = await axios.post<ExecuteQueriesResponse>(
    `${API}/groups/${target.workspaceId}/datasets/${target.datasetId}/executeQueries`,
    { queries: [{ query: target.query }], serializerSettings: { includeNulls: true } },
    { ...bearer(aad.token), timeout: 30_000 }
  );

  const results = response.data.results ?? [];
  const rows = results[0]?.tables?.[0]?.rows ?? [];

  return {
    success: true,
    executionTimeMs: Date.now() - startedAt,
    rowCount: rows.length,
    rows,
    rawResults: results,
  };
}
