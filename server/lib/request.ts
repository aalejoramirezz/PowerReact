import type { ServicePrincipalCredentials } from '../config.js';

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

export function optionalString(source: UnknownRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Per-request Service Principal overrides (body or query string); falls back to .env defaults. */
export function resolveCredentials(
  defaults: ServicePrincipalCredentials,
  source: UnknownRecord
): ServicePrincipalCredentials {
  return {
    tenantId: optionalString(source, 'tenantId') ?? defaults.tenantId,
    clientId: optionalString(source, 'clientId') ?? defaults.clientId,
    clientSecret: optionalString(source, 'clientSecret') ?? defaults.clientSecret,
  };
}
