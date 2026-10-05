import { Router } from 'express';
import { extractPowerBiErrorMessage, normalizeError } from '../lib/errors.js';
import { asRecord, optionalString, resolveCredentials } from '../lib/request.js';
import { executeDaxQuery, getEmbedConfig } from '../services/powerbi.js';
import type { RouteDeps } from './types.js';

function embedErrorHint(status: number): string {
  if (status === 403) {
    return '403 Forbidden: Ensure "Allow service principals to use Power BI APIs" is enabled in Power BI Admin Portal and the App is added as Member/Admin to the workspace.';
  }
  if (status === 404) {
    return '404 Not Found: Check if workspace ID or report ID exists and matches.';
  }
  return 'Make sure the Service Principal has access to this workspace.';
}

export function powerBiRouter({ config, tokens }: RouteDeps): Router {
  const router = Router();

  router.get('/powerbi/preconfigured', (_req, res) => {
    res.json(config.preconfiguredReports);
  });

  // Generate Power BI Embed Configuration (embed token + report metadata)
  router.post('/powerbi/embed-config', async (req, res) => {
    const body = asRecord(req.body);
    const workspaceId = optionalString(body, 'workspaceId');
    const reportId = optionalString(body, 'reportId');

    if (!workspaceId || !reportId) {
      res.status(400).json({ success: false, error: 'workspaceId and reportId are required' });
      return;
    }

    try {
      const embedConfig = await getEmbedConfig(tokens, resolveCredentials(config.credentials, body), {
        workspaceId,
        reportId,
        pageName: optionalString(body, 'pageName'),
      });
      res.json(embedConfig);
    } catch (error) {
      const { status, details } = normalizeError(error);
      res.status(status).json({
        success: false,
        error: 'Failed to generate embed configuration',
        hint: embedErrorHint(status),
        details,
      });
    }
  });

  // Direct DAX Query against the Semantic Model (VertiPaq Engine)
  router.post('/powerbi/query', async (req, res) => {
    const body = asRecord(req.body);
    const query = optionalString(body, 'query');

    if (!query) {
      res.status(400).json({ success: false, error: 'A valid DAX query string is required' });
      return;
    }

    const startedAt = Date.now();
    try {
      const result = await executeDaxQuery(tokens, resolveCredentials(config.credentials, body), {
        workspaceId: optionalString(body, 'workspaceId') ?? config.semanticModel.workspaceId,
        datasetId: optionalString(body, 'datasetId') ?? config.semanticModel.datasetId,
        query,
      });
      res.json(result);
    } catch (error) {
      const { status, details } = normalizeError(error);
      res.status(status).json({
        success: false,
        executionTimeMs: Date.now() - startedAt,
        error: 'DAX Query Execution failed',
        hint: extractPowerBiErrorMessage(details),
        details,
      });
    }
  });

  return router;
}
