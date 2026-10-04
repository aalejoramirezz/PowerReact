import path from 'node:path';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { TokenCache } from './auth/tokenCache.js';
import type { AppConfig } from './config.js';
import { normalizeError } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { fabricRouter } from './routes/fabric.js';
import { healthRouter } from './routes/health.js';
import { powerBiRouter } from './routes/powerbi.js';

export function createApp(config: AppConfig, tokens: TokenCache = new TokenCache()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const deps = { config, tokens };
  app.use('/api', healthRouter(deps), authRouter(deps), powerBiRouter(deps), fabricRouter(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // Production: serve the built SPA and let React Router handle client-side paths
  if (config.clientDistDir) {
    const indexHtml = path.join(config.clientDistDir, 'index.html');
    app.use(express.static(config.clientDistDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(indexHtml);
    });
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const { status, message } = normalizeError(error);
    res.status(status).json({ success: false, error: message });
  };
  app.use(errorHandler);

  return app;
}
