/** Error raised for non-2xx responses or `{ success: false }` payloads from the BFF. */
export class ApiError extends Error {
  readonly status: number;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, hint?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.hint = hint;
    this.details = details;
  }
}

interface ErrorPayload {
  success?: boolean;
  error?: string;
  hint?: string;
  details?: unknown;
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON body (e.g. proxy error page); handled below
  }

  const errorPayload = (payload ?? {}) as ErrorPayload;
  if (!res.ok || errorPayload.success === false || payload === null) {
    throw new ApiError(
      errorPayload.error || `Request failed with status ${res.status}`,
      res.status,
      errorPayload.hint,
      errorPayload.details
    );
  }

  return payload as T;
}

export function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return request<T>(url, { signal });
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.hint ? `${error.message}: ${error.hint}` : error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}
