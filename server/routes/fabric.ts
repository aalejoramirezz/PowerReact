import { Router } from 'express';
import { normalizeError } from '../lib/errors.js';
import { asRecord, optionalString, resolveCredentials } from '../lib/request.js';
import {
  DataAgentError,
  listWorkspaceItems,
  listWorkspaces,
  queryDataAgent,
  type ChatTurn,
} from '../services/fabric.js';
import type { RouteDeps } from './types.js';

const MAX_HISTORY_TURNS = 10;

/** Keeps only well-formed user/assistant turns, newest last. */
export function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter(
      (turn): turn is { role: ChatTurn['role']; content: string } =>
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string' &&
        turn.content.trim() !== ''
    )
    .map(({ role, content }) => ({ role, content }))
    .slice(-MAX_HISTORY_TURNS);
}

function dataAgentHint(error: unknown, status: number, details: unknown, ids: Record<string, string>): string {
  const isCrossGeo =
    (error instanceof DataAgentError && error.isCrossGeo) ||
    JSON.stringify(details ?? '').includes('DisallowedForStoreDataCrossGeo');

  if (isCrossGeo) {
    return '🌍 Cross-Geo Processing Disabled: Fabric capacity/tenant is in Canada Central and requires cross-region processing for Azure OpenAI. Resolution: In Fabric Admin Portal > Tenant settings > "Copilot and Azure OpenAI" > Enable "Data sent to Azure OpenAI can be processed outside your capacity\'s geographic region". (Also verify under Fabric Capacity Settings > Delegated tenant settings).';
  }
  if (status === 403) {
    return `403 InsufficientPrivileges: The Service Principal (Client ID: ${ids.clientId}) does NOT have access to workspace "${ids.workspaceId}". Please go to the Fabric/Power BI workspace > Manage access > Add the Service Principal as Member or Contributor.`;
  }
  if (status === 404) {
    return `404 EntityNotFound: Item "${ids.agentId}" was not found or is not published in workspace "${ids.workspaceId}".`;
  }
  return 'Verify that the Data Agent / AI Skill is published and the Service Principal is a Member/Contributor in the workspace.';
}

export function fabricRouter({ config, tokens }: RouteDeps): Router {
  const router = Router();

  // List workspaces available to the Service Principal
  router.get('/workspaces', async (req, res) => {
    try {
      const workspaces = await listWorkspaces(tokens, resolveCredentials(config.credentials, asRecord(req.query)));
      res.json({ success: true, workspaces });
    } catch (error) {
      const { status, details } = normalizeError(error);
      res.status(status).json({ success: false, error: 'Failed to fetch workspaces', details });
    }
  });

  // List items in a workspace (Reports, Paginated Reports, Data Agents, etc.)
  router.get('/workspaces/:workspaceId/items', async (req, res) => {
    try {
      const items = await listWorkspaceItems(
        tokens,
        resolveCredentials(config.credentials, asRecord(req.query)),
        req.params.workspaceId
      );
      res.json({ success: true, items });
    } catch (error) {
      const { status, details } = normalizeError(error);
      res.status(status).json({ success: false, error: 'Failed to fetch workspace items', details });
    }
  });

  // Query a Fabric Data Agent
  router.post('/fabric/data-agent/query', async (req, res) => {
    const body = asRecord(req.body);
    const workspaceId = optionalString(body, 'workspaceId');
    const agentId = optionalString(body, 'agentId');
    const prompt = optionalString(body, 'prompt');

    if (!workspaceId || !agentId || !prompt) {
      res.status(400).json({ success: false, error: 'workspaceId, agentId, and prompt are required' });
      return;
    }

    const credentials = resolveCredentials(config.credentials, body);

    try {
      const result = await queryDataAgent(tokens, credentials, {
        workspaceId,
        agentId,
        prompt,
        history: parseHistory(body.history),
      });
      res.json({ success: true, ...result });
    } catch (error) {
      const { status, message, details } = normalizeError(error);
      res.status(status).json({
        success: false,
        error: message || 'Data Agent / AI Skill query failed',
        hint: dataAgentHint(error, status, details, { clientId: credentials.clientId, workspaceId, agentId }),
        status,
        details,
      });
    }
  });

  return router;
}
