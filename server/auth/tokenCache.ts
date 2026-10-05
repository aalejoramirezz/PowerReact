import axios from 'axios';
import type { ServicePrincipalCredentials } from '../config.js';

export const SCOPES = {
  powerBi: 'https://analysis.windows.net/powerbi/api/.default',
  fabric: 'https://api.fabric.microsoft.com/.default',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export interface AccessToken {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

interface TokenEndpointResponse {
  access_token: string;
  expires_in?: number;
}

/** Tokens are reused while they have at least this much life left. */
const REFRESH_MARGIN_MS = 2 * 60_000;

/**
 * Entra ID client-credentials tokens, cached per tenant/client/scope (~400ms saved per request).
 * Concurrent requests for the same key share a single in-flight token call.
 */
export class TokenCache {
  private readonly tokens = new Map<string, AccessToken>();
  private readonly inflight = new Map<string, Promise<AccessToken>>();

  async getToken(scope: Scope, credentials: ServicePrincipalCredentials): Promise<AccessToken> {
    const { tenantId, clientId, clientSecret } = credentials;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Missing Service Principal credentials (tenantId, clientId, or clientSecret)');
    }

    const key = `${tenantId}:${clientId}:${scope}`;
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
      return cached;
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const request = this.requestToken(scope, credentials)
      .then((token) => {
        this.tokens.set(key, token);
        return token;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, request);
    return request;
  }

  clear(): void {
    this.tokens.clear();
    this.inflight.clear();
  }

  private async requestToken(scope: Scope, credentials: ServicePrincipalCredentials): Promise<AccessToken> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope,
    });

    const requestedAt = Date.now();
    const response = await axios.post<TokenEndpointResponse>(
      `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      token: response.data.access_token,
      expiresAt: requestedAt + (response.data.expires_in ?? 3600) * 1000,
    };
  }
}
