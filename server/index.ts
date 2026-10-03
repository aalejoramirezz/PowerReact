import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Default credentials from .env
const DEFAULT_TENANT_ID = process.env.AZURE_TENANT_ID || '';
const DEFAULT_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const DEFAULT_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';

// Preconfigured reports from UDP database fg_demo.udp.PBIReport
const PRECONFIGURED_REPORTS = [
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

// Token Cache to avoid re-authenticating on every request (~400ms speedup)
interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

// Helper to get Entra ID token using Client Credentials Flow with caching
async function getEntraToken(
  scope: string,
  credentials?: { tenantId?: string; clientId?: string; clientSecret?: string }
): Promise<string> {
  const tenantId = credentials?.tenantId?.trim() || DEFAULT_TENANT_ID;
  const clientId = credentials?.clientId?.trim() || DEFAULT_CLIENT_ID;
  const clientSecret = credentials?.clientSecret?.trim() || DEFAULT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Service Principal credentials (tenantId, clientId, or clientSecret)');
  }

  const cacheKey = `${tenantId}:${clientId}:${scope}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);

  // Return cached token if valid for at least 2 more minutes
  if (cached && cached.expiresAt > now + 120000) {
    return cached.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scope);

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const accessToken = response.data.access_token;
  const expiresInSec = response.data.expires_in || 3600;
  tokenCache.set(cacheKey, {
    token: accessToken,
    expiresAt: now + expiresInSec * 1000,
  });

  return accessToken;
}

// 1. Health check & current configuration
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    configured: Boolean(DEFAULT_TENANT_ID && DEFAULT_CLIENT_ID && DEFAULT_CLIENT_SECRET),
    tenantId: DEFAULT_TENANT_ID,
    clientId: DEFAULT_CLIENT_ID ? `${DEFAULT_CLIENT_ID.substring(0, 8)}...` : null,
    unityDomain: process.env.UNITY_DOMAIN || 'https://gateway.unitystage.net',
  });
});

// 2. Preconfigured reports list
app.get('/api/powerbi/preconfigured', (req: Request, res: Response) => {
  res.json(PRECONFIGURED_REPORTS);
});

// 3. Test Authentication for both Power BI & Fabric
app.post('/api/auth/test', async (req: Request, res: Response) => {
  const { tenantId, clientId, clientSecret } = req.body;
  const creds = { tenantId, clientId, clientSecret };

  try {
    const pbiPromise = getEntraToken('https://analysis.windows.net/powerbi/api/.default', creds);
    const fabricPromise = getEntraToken('https://api.fabric.microsoft.com/.default', creds);

    const [pbiToken, fabricToken] = await Promise.all([pbiPromise, fabricPromise]);

    res.json({
      success: true,
      powerBiTokenAcquired: Boolean(pbiToken),
      powerBiTokenPreview: `${pbiToken.substring(0, 15)}...${pbiToken.substring(pbiToken.length - 10)}`,
      fabricTokenAcquired: Boolean(fabricToken),
      fabricTokenPreview: `${fabricToken.substring(0, 15)}...${fabricToken.substring(fabricToken.length - 10)}`,
      message: 'Both Power BI and Fabric tokens acquired successfully via Service Principal!',
    });
  } catch (error: any) {
    const errorDetails = error.response?.data || error.message;
    res.status(400).json({
      success: false,
      error: 'Authentication failed',
      details: errorDetails,
    });
  }
});

// 4. List Workspaces available to the Service Principal
app.get('/api/workspaces', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
  const clientId = (req.query.clientId as string) || DEFAULT_CLIENT_ID;
  const clientSecret = (req.query.clientSecret as string) || DEFAULT_CLIENT_SECRET;

  try {
    const token = await getEntraToken('https://api.fabric.microsoft.com/.default', {
      tenantId,
      clientId,
      clientSecret,
    });

    const response = await axios.get('https://api.fabric.microsoft.com/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.json({
      success: true,
      workspaces: response.data.value || [],
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch workspaces',
      details: error.response?.data || error.message,
    });
  }
});

// 5. List items in a workspace (Reports, Paginated Reports, Data Agents, etc.)
app.get('/api/workspaces/:workspaceId/items', async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
  const clientId = (req.query.clientId as string) || DEFAULT_CLIENT_ID;
  const clientSecret = (req.query.clientSecret as string) || DEFAULT_CLIENT_SECRET;

  try {
    const token = await getEntraToken('https://api.fabric.microsoft.com/.default', {
      tenantId,
      clientId,
      clientSecret,
    });

    const response = await axios.get(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.json({
      success: true,
      items: response.data.value || [],
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch workspace items',
      details: error.response?.data || error.message,
    });
  }
});

// 6. Generate Power BI Embed Configuration
app.post('/api/powerbi/embed-config', async (req: Request, res: Response) => {
  const { workspaceId, reportId, tenantId, clientId, clientSecret, pageName } = req.body;

  if (!workspaceId || !reportId) {
    return res.status(400).json({ error: 'workspaceId and reportId are required' });
  }

  const creds = { tenantId, clientId, clientSecret };

  try {
    const aadToken = await getEntraToken('https://analysis.windows.net/powerbi/api/.default', creds);

    // Get report metadata
    const reportUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
    const reportRes = await axios.get(reportUrl, {
      headers: { Authorization: `Bearer ${aadToken}` },
    });

    const reportData = reportRes.data;
    const isPaginated =
      reportData.reportType === 'PaginatedReport' ||
      (reportData.embedUrl && reportData.embedUrl.includes('rdlEmbed'));

    let embedToken = '';
    let expiration = '';

    // Generate Embed Token using GenerateToken API
    try {
      // V1 token generation endpoint for the report
      const tokenGenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
      const tokenRes = await axios.post(
        tokenGenUrl,
        { accessLevel: 'View' },
        {
          headers: {
            Authorization: `Bearer ${aadToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      embedToken = tokenRes.data.token;
      expiration = tokenRes.data.expiration;
    } catch (tokenErr: any) {
      // Fallback: If GenerateToken fails (e.g. workspace not on dedicated capacity), check V2 GenerateToken
      try {
        const v2Url = `https://api.powerbi.com/v1.0/myorg/GenerateToken`;
        const v2Body: any = {
          reports: [{ id: reportId }],
          targetWorkspaces: [{ id: workspaceId }],
        };
        if (reportData.datasetId) {
          v2Body.datasets = [{ id: reportData.datasetId }];
        }
        const v2Res = await axios.post(v2Url, v2Body, {
          headers: {
            Authorization: `Bearer ${aadToken}`,
            'Content-Type': 'application/json',
          },
        });
        embedToken = v2Res.data.token;
        expiration = v2Res.data.expiration;
      } catch (v2Err: any) {
        // If Embed Token generation fails, we can fall back to using AAD token directly
        console.warn('Embed token generation failed; falling back to AAD token.', v2Err.response?.data || v2Err.message);
        embedToken = aadToken;
      }
    }

    res.json({
      success: true,
      reportId: reportData.id,
      reportName: reportData.name,
      embedUrl: reportData.embedUrl,
      datasetId: reportData.datasetId,
      accessToken: embedToken,
      tokenType: embedToken === aadToken ? 'Aad' : 'Embed',
      isPaginated,
      expiration,
      webUrl: reportData.webUrl,
      pageName: pageName || undefined,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;

    let hint = 'Make sure the Service Principal has access to this workspace.';
    if (status === 403) {
      hint = '403 Forbidden: Ensure "Allow service principals to use Power BI APIs" is enabled in Power BI Admin Portal and the App is added as Member/Admin to the workspace.';
    } else if (status === 404) {
      hint = '404 Not Found: Check if workspace ID or report ID exists and matches.';
    }

    res.status(status).json({
      success: false,
      error: 'Failed to generate embed configuration',
      hint,
      details,
    });
  }
});

// 6.5 Direct DAX Query against Semantic Model (VertiPaq Engine)
app.post('/api/powerbi/query', async (req: Request, res: Response) => {
  const {
    workspaceId = 'ef45c53d-42d4-48c6-be79-380b8d890c80',
    datasetId = '0db033d0-4f4e-4d72-a280-007d6f17e2ec',
    query,
    tenantId,
    clientId,
    clientSecret,
  } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'A valid DAX query string is required' });
  }

  const creds = { tenantId, clientId, clientSecret };
  const startTime = Date.now();

  try {
    const aadToken = await getEntraToken('https://analysis.windows.net/powerbi/api/.default', creds);

    const queryUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
    const response = await axios.post(
      queryUrl,
      {
        queries: [{ query }],
        serializerSettings: { includeNulls: true },
      },
      {
        headers: {
          Authorization: `Bearer ${aadToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const durationMs = Date.now() - startTime;
    const rawTables = response.data?.results?.[0]?.tables || [];
    const rows = rawTables[0]?.rows || [];

    res.json({
      success: true,
      executionTimeMs: durationMs,
      rowCount: rows.length,
      rows,
      rawResults: response.data?.results || [],
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;

    res.status(status).json({
      success: false,
      executionTimeMs: durationMs,
      error: 'DAX Query Execution failed',
      details,
    });
  }
});

// 7. Query Fabric Data Agent
app.post('/api/fabric/data-agent/query', async (req: Request, res: Response) => {
  const { workspaceId, agentId, prompt, history, tenantId, clientId, clientSecret } = req.body;

  if (!workspaceId || !agentId || !prompt) {
    return res.status(400).json({ error: 'workspaceId, agentId, and prompt are required' });
  }

  const creds = { tenantId, clientId, clientSecret };

  try {
    const token = await getEntraToken('https://api.fabric.microsoft.com/.default', creds);

    const mcpUrl = `https://api.fabric.microsoft.com/v1/mcp/workspaces/${workspaceId}/dataagents/${agentId}/agent`;

    // 1. Try MCP discovery first
    let toolName = 'DataAgent_Agent_1';
    try {
      const listToolsRes = await axios.post(
        mcpUrl,
        { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      if (listToolsRes.data?.result?.tools?.[0]?.name) {
        toolName = listToolsRes.data.result.tools[0].name;
      }
    } catch (e: any) {
      console.warn('MCP tools/list warning:', e.message);
    }

    const mcpPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: { userQuestion: prompt },
      },
    };

    const requestPayload = {
      messages: [
        ...(Array.isArray(history) ? history : []),
        { role: 'user', content: prompt },
      ],
      stream: false,
    };

    // Endpoint cascade for Fabric Data Agent / AI Skill
    const endpointsToTry = [
      {
        name: `Fabric MCP Data Agent (${toolName})`,
        url: mcpUrl,
        body: mcpPayload,
      },
      {
        name: 'Fabric MCP Data Agent REST',
        url: mcpUrl,
        body: requestPayload,
      },
      {
        name: 'Fabric AI Skill Query API',
        url: `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/aiskills/${agentId}/query`,
        body: { prompt, userQuestion: prompt },
      },
      {
        name: 'Fabric Data Agent Conversations API',
        url: `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataagents/${agentId}/conversations`,
        body: { prompt, messages: requestPayload.messages },
      },
    ];

    let agentResponse: any = null;
    let endpointUsed = '';
    let lastError: any = null;

    for (const ep of endpointsToTry) {
      try {
        endpointUsed = `${ep.name} (${ep.url})`;
        const response = await axios.post(ep.url, ep.body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        });

        // Check if Fabric returned a JSON-RPC error payload with HTTP 200
        if (response.data?.error) {
          const errObj = response.data.error;
          const msg = errObj.message || 'MCP Error';

          // Extract DisallowedForStoreDataCrossGeo
          if (msg.includes('DisallowedForStoreDataCrossGeo')) {
            lastError = {
              response: {
                status: 403,
                data: errObj,
              },
              isCrossGeo: true,
              message: msg,
            };
            break;
          }

          if (msg.includes('not authorized') || errObj.data?.errorCode === 'Unauthorized') {
            lastError = {
              response: {
                status: 403,
                data: errObj,
              },
              message: msg,
            };
            break;
          }

          lastError = {
            response: { status: 400, data: errObj },
            message: msg,
          };
          continue;
        }

        // Format MCP tool output for display
        if (response.data?.result?.content) {
          const contentList = response.data.result.content;
          const textItems = contentList.filter((c: any) => c.type === 'text').map((c: any) => c.text);
          response.data.response = textItems.join('\n\n');
        }

        agentResponse = response.data;
        break;
      } catch (err: any) {
        lastError = err;
        if (err.response?.status === 403 || err.response?.status === 401) {
          break;
        }
      }
    }

    if (!agentResponse && lastError) {
      throw lastError;
    }

    res.json({
      success: true,
      endpointUsed,
      data: agentResponse,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;

    let hint = 'Verify that the Data Agent / AI Skill is published and the Service Principal is a Member/Contributor in the workspace.';

    if (error.isCrossGeo || JSON.stringify(details).includes('DisallowedForStoreDataCrossGeo')) {
      hint = '🌍 Cross-Geo Processing Disabled: Fabric capacity/tenant is in Canada Central and requires cross-region processing for Azure OpenAI. Resolution: In Fabric Admin Portal > Tenant settings > "Copilot and Azure OpenAI" > Enable "Data sent to Azure OpenAI can be processed outside your capacity\'s geographic region". (Also verify under Fabric Capacity Settings > Delegated tenant settings).';
    } else if (status === 403) {
      hint = `403 InsufficientPrivileges: The Service Principal (Client ID: ${clientId}) does NOT have access to workspace "${workspaceId}". Please go to the Fabric/Power BI workspace > Manage access > Add the Service Principal as Member or Contributor.`;
    } else if (status === 404) {
      hint = `404 EntityNotFound: Item "${agentId}" was not found or is not published in workspace "${workspaceId}".`;
    }

    res.status(status).json({
      success: false,
      error: error.message || 'Data Agent / AI Skill query failed',
      hint,
      status,
      details,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Embed Playground API Server running on port ${PORT}`);
});
