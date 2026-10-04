import { Router } from 'express';
import type { RouteDeps } from './types.js';

export function healthRouter({ config }: RouteDeps): Router {
  const router = Router();
  const { tenantId, clientId, clientSecret } = config.credentials;

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      configured: Boolean(tenantId && clientId && clientSecret),
      tenantId,
      clientId: clientId ? `${clientId.substring(0, 8)}...` : null,
      unityDomain: config.unityDomain,
    });
  });

  return router;
}
