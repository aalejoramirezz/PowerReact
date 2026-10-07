import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ServicePrincipalCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface PreconfiguredReport {
  id: number;
  code: string;
  description: string;
  workspaceId: string;
  reportId: string;
  pageName?: string;
  type: 'Report' | 'PaginatedReport';
}

export interface AppConfig {
  port: number;
  credentials: ServicePrincipalCredentials;
  unityDomain: string;
  semanticModel: { workspaceId: string; datasetId: string };
  /**
   * Datasets /api/powerbi/query may run DAX against (lower-case ids). Manifests name their own data
   * source, so a client can ask for any dataset the Service Principal reaches: only these answer.
   * `['*']` allows any (development only).
   */
  allowedDatasets: string[];
  preconfiguredReports: PreconfiguredReport[];
  /** Built client (Vite `dist/`) served by Express when present. */
  clientDistDir: string | null;
}

// Preconfigured reports from UDP database fg_demo.udp.PBIReport
export const PRECONFIGURED_REPORTS: PreconfiguredReport[] = [
  {
    id: 1,
    code: 'AssetFinda_Financial_Master_Suite',
    description: 'AssetFinda_Financial_Master_Suite',
    workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
    reportId: '0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e',
    pageName: 'p_m_f1',
    type: 'Report',
  },
  {
    id: 2,
    code: 'Assets-Valuation',
    description: 'Asset Valuation Register (AssetFinda)',
    workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
    reportId: '0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e',
    pageName: 'p_m_f1',
    type: 'Report',
  },
  {
    id: 3,
    code: 'AssetFinda-Report-Suite',
    description: 'AssetFinda_Report_Suite',
    workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
    reportId: '23e25593-a204-4921-800a-9b81408ccdf2',
    type: 'Report',
  },
  {
    id: 4,
    code: 'CIS-WorkOrders',
    description: 'Work Orders PowerBI Report in CIS',
    workspaceId: '1C765A85-2C33-459B-A126-6C8FAE292E41',
    reportId: '1309E878-BEEE-4627-9277-429E61E9A830',
    type: 'PaginatedReport',
  },
  {
    id: 5,
    code: 'Bozeman_SLA',
    description: 'Bozeman SLA Demo',
    workspaceId: '92344BF5-8207-449C-A718-002B0666968C',
    reportId: '8567CD4E-CE00-4FCA-98E0-6E04E6830D6E',
    type: 'Report',
  },
];

/** PBI_ALLOWED_DATASETS: comma-separated dataset ids (or `*`); defaults to the configured dataset. */
export function parseAllowedDatasets(value: string | undefined, defaultDatasetId: string): string[] {
  const ids = (value ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  return ids.length ? ids : [defaultDatasetId.toLowerCase()];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const distDir = path.resolve('dist');
  const datasetId = env.PBI_DATASET_ID || '0db033d0-4f4e-4d72-a280-007d6f17e2ec';

  return {
    port: Number(env.PORT) || 5000,
    credentials: {
      tenantId: env.AZURE_TENANT_ID ?? '',
      clientId: env.AZURE_CLIENT_ID ?? '',
      clientSecret: env.AZURE_CLIENT_SECRET ?? '',
    },
    unityDomain: env.UNITY_DOMAIN || 'https://gateway.unitystage.net',
    semanticModel: {
      workspaceId: env.PBI_WORKSPACE_ID || 'ef45c53d-42d4-48c6-be79-380b8d890c80',
      datasetId,
    },
    allowedDatasets: parseAllowedDatasets(env.PBI_ALLOWED_DATASETS, datasetId),
    preconfiguredReports: PRECONFIGURED_REPORTS,
    clientDistDir: existsSync(path.join(distDir, 'index.html')) ? distDir : null,
  };
}
