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
  expiration: string;
  datasetId?: string;
  webUrl?: string;
  pageName?: string;
}

export interface FabricWorkspace {
  id: string;
  displayName: string;
  type: string;
  description?: string;
}

export interface FabricItem {
  id: string;
  displayName: string;
  type: string;
  workspaceId: string;
  description?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sqlQuery?: string;
  data?: any;
  raw?: any;
  error?: boolean;
}
