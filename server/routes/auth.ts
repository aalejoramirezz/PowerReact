import { Router } from 'express';
import { SCOPES } from '../auth/tokenCache.js';
import { normalizeError } from '../lib/errors.js';
import { asRecord, resolveCredentials } from '../lib/request.js';
import type { RouteDeps } from './types.js';

const preview = (token: string) => `${token.substring(0, 15)}...${token.substring(token.length - 10)}`;

export function authRouter({ config, tokens }: RouteDeps): Router {
  const router = Router();

  // Test authentication for both Power BI & Fabric
  router.post('/auth/test', async (req, res) => {
    const credentials = resolveCredentials(config.credentials, asRecord(req.body));

    try {
      const [pbi, fabric] = await Promise.all([
        tokens.getToken(SCOPES.powerBi, credentials),
        tokens.getToken(SCOPES.fabric, credentials),
      ]);

      res.json({
        success: true,
        powerBiTokenAcquired: Boolean(pbi.token),
        powerBiTokenPreview: preview(pbi.token),
        fabricTokenAcquired: Boolean(fabric.token),
        fabricTokenPreview: preview(fabric.token),
        message: 'Both Power BI and Fabric tokens acquired successfully via Service Principal!',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Authentication failed',
        details: normalizeError(error).details,
      });
    }
  });

  return router;
}
