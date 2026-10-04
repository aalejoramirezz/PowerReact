import axios from 'axios';
import { SCOPES, type TokenCache } from '../auth/tokenCache.js';
import type { ServicePrincipalCredentials } from '../config.js';
import { HttpError } from '../lib/errors.js';

const API = 'https://api.fabric.microsoft.com/v1';

export interface FabricEntity {
  id: string;
  displayName: string;
  type: string;
  description?: string;
  workspaceId?: string;
}

interface FabricListResponse {
  value?: FabricEntity[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface McpContent {
  type: string;
  text?: string;
}

interface JsonRpcError {
  message?: string;
  data?: { errorCode?: string };
}

export interface DataAgentPayload {
  result?: { content?: McpContent[]; tools?: Array<{ name: string }> };
  error?: JsonRpcError;
  /** Flattened text answer, filled in from MCP `result.content`. */
  response?: string;
  [key: string]: unknown;
}

export interface DataAgentResult {
  endpointUsed: string;
  data: DataAgentPayload;
}

/** Raised when Fabric answers HTTP 200 with a JSON-RPC error that we should not retry. */
export class DataAgentError extends HttpError {
  readonly isCrossGeo: boolean;

  constructor(status: number, message: string, details: unknown, isCrossGeo = false) {
    super(status, message, details);
    this.name = 'DataAgentError';
    this.isCrossGeo = isCrossGeo;
  }
}

const bearer = (token: string, timeout?: number) => ({
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(timeout ? { timeout } : {}),
});

export async function listWorkspaces(
  tokens: TokenCache,
  credentials: ServicePrincipalCredentials
): Promise<FabricEntity[]> {
  const { token } = await tokens.getToken(SCOPES.fabric, credentials);
  const res = await axios.get<FabricListResponse>(`${API}/workspaces`, bearer(token));
  return res.data.value ?? [];
}

export async function listWorkspaceItems(
  tokens: TokenCache,
  credentials: ServicePrincipalCredentials,
  workspaceId: string
): Promise<FabricEntity[]> {
  const { token } = await tokens.getToken(SCOPES.fabric, credentials);
  const res = await axios.get<FabricListResponse>(`${API}/workspaces/${workspaceId}/items`, bearer(token));
  return res.data.value ?? [];
}

async function discoverToolName(mcpUrl: string, token: string): Promise<string> {
  try {
    const res = await axios.post<DataAgentPayload>(
      mcpUrl,
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      bearer(token, 15_000)
    );
    return res.data.result?.tools?.[0]?.name ?? 'DataAgent_Agent_1';
  } catch (error) {
    console.warn('MCP tools/list warning:', error instanceof Error ? error.message : error);
    return 'DataAgent_Agent_1';
  }
}

function toJsonRpcError(errObj: JsonRpcError): DataAgentError {
  const message = errObj.message || 'MCP Error';
  if (message.includes('DisallowedForStoreDataCrossGeo')) {
    return new DataAgentError(403, message, errObj, true);
  }
  if (message.includes('not authorized') || errObj.data?.errorCode === 'Unauthorized') {
    return new DataAgentError(403, message, errObj);
  }
  return new DataAgentError(400, message, errObj);
}

export async function queryDataAgent(
  tokens: TokenCache,
  credentials: ServicePrincipalCredentials,
  request: { workspaceId: string; agentId: string; prompt: string; history: ChatTurn[] }
): Promise<DataAgentResult> {
  const { workspaceId, agentId, prompt, history } = request;
  const { token } = await tokens.getToken(SCOPES.fabric, credentials);

  const mcpUrl = `${API}/mcp/workspaces/${workspaceId}/dataagents/${agentId}/agent`;
  const toolName = await discoverToolName(mcpUrl, token);
  const messages: ChatTurn[] = [...history, { role: 'user', content: prompt }];

  // Endpoint cascade for Fabric Data Agent / AI Skill. The MCP tool only accepts a single
  // question, so the conversation history is forwarded to the endpoints that take `messages`.
  const endpoints = [
    {
      name: `Fabric MCP Data Agent (${toolName})`,
      url: mcpUrl,
      body: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: { userQuestion: prompt } },
      },
    },
    { name: 'Fabric MCP Data Agent REST', url: mcpUrl, body: { messages, stream: false } },
    {
      name: 'Fabric AI Skill Query API',
      url: `${API}/workspaces/${workspaceId}/aiskills/${agentId}/query`,
      body: { prompt, userQuestion: prompt },
    },
    {
      name: 'Fabric Data Agent Conversations API',
      url: `${API}/workspaces/${workspaceId}/dataagents/${agentId}/conversations`,
      body: { prompt, messages },
    },
  ];

  let lastError: unknown = new HttpError(502, 'No Data Agent endpoint answered');

  for (const endpoint of endpoints) {
    const endpointUsed = `${endpoint.name} (${endpoint.url})`;
    try {
      const res = await axios.post<DataAgentPayload>(endpoint.url, endpoint.body, bearer(token, 60_000));
      const payload = res.data;

      // Fabric can return a JSON-RPC error payload with HTTP 200
      if (payload.error) {
        const rpcError = toJsonRpcError(payload.error);
        lastError = rpcError;
        if (rpcError.status === 403) break;
        continue;
      }

      if (payload.result?.content) {
        payload.response = payload.result.content
          .filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('\n\n');
      }

      return { endpointUsed, data: payload };
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) break;
    }
  }

  throw lastError;
}
