import axios from 'axios';

/** An error that already knows the HTTP status and payload it should produce. */
export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details ?? message;
  }
}

export interface NormalizedError {
  status: number;
  message: string;
  details: unknown;
}

/** Collapses axios, HttpError and unknown throwables into one shape for JSON responses. */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message, details: error.details };
  }
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? 500,
      message: error.message,
      details: error.response?.data ?? error.message,
    };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message, details: error.message };
  }
  return { status: 500, message: 'Unknown error', details: String(error) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Digs the human-readable DAX/engine message out of a Power BI REST error payload:
 * { error: { "pbi.error": { details: [{ detail: { value: "Query (3, 5) ..." } }] } } }
 */
export function extractPowerBiErrorMessage(details: unknown): string | undefined {
  if (!isRecord(details) || !isRecord(details.error)) return undefined;
  const pbiError = details.error['pbi.error'];
  if (isRecord(pbiError) && Array.isArray(pbiError.details)) {
    for (const entry of pbiError.details) {
      if (isRecord(entry) && isRecord(entry.detail) && typeof entry.detail.value === 'string') {
        return entry.detail.value;
      }
    }
  }
  return typeof details.error.message === 'string' ? details.error.message : undefined;
}
