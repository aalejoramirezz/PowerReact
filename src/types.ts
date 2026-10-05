export interface PreconfiguredReport {
  id: number;
  code: string;
  description: string;
  workspaceId: string;
  reportId: string;
  pageName?: string;
  type: 'Report' | 'PaginatedReport';
}

export interface ReportEmbedConfig {
  reportId: string;
  reportName: string;
  embedUrl: string;
  accessToken: string;
  tokenType: 'Embed' | 'Aad';
  isPaginated: boolean;
  /** ISO timestamp of the access token expiry. */
  expiration: string;
  datasetId?: string;
  webUrl?: string;
  pageName?: string;
}

export interface HealthStatus {
  status: string;
  configured: boolean;
  tenantId: string;
  clientId: string | null;
  unityDomain: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  /** Raw Data Agent payload, kept for debugging. */
  data?: unknown;
  error?: boolean;
}
