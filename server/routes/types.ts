import type { TokenCache } from '../auth/tokenCache.js';
import type { AppConfig } from '../config.js';

export interface RouteDeps {
  config: AppConfig;
  tokens: TokenCache;
}
