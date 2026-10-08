import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { postJson } from '../api/http';
import type { DaxRow } from '../lib/dax/types';
import { useDaxLogStore } from '../store/daxLog';

interface DaxQueryResponse {
  success: true;
  executionTimeMs?: number;
  rowCount?: number;
  rows: DaxRow[];
}

/** Root key for every semantic-model query; invalidate it to refresh all visuals. */
export const DAX_QUERY_KEY = ['dax'] as const;

/** The semantic model refreshes far less often than this; Refresh invalidates explicitly. */
const DAX_STALE_TIME = 5 * 60_000;

/** A semantic model other than the BFF's default (manifests name their own data source). */
export interface DaxTarget {
  workspaceId: string;
  datasetId: string;
}

/** Runs DAX through the BFF and records it in the inspector log. */
export async function executeDax(title: string, dax: string, signal?: AbortSignal, target?: DaxTarget): Promise<DaxRow[]> {
  const startedAt = performance.now();
  const data = await postJson<DaxQueryResponse>('/api/powerbi/query', { query: dax, ...target }, signal);
  const rows = Array.isArray(data.rows) ? data.rows : [];

  useDaxLogStore.getState().record({
    title,
    dax: dax.trim(),
    durationMs: data.executionTimeMs ?? Math.round(performance.now() - startedAt),
    rowCount: data.rowCount ?? rows.length,
  });

  return rows;
}

export interface SemanticQuerySpec<T> {
  /** Distinguishes result shapes that could share DAX text. */
  kind: string;
  title: string;
  dax: string;
  parse: (rows: DaxRow[]) => T;
  /** Default: the dataset configured in the BFF. */
  target?: DaxTarget;
}

/**
 * The DAX text (with its dataset) is the cache key, so every filter combination gets its own entry
 * and a late response can never overwrite a newer one. The AbortSignal cancels superseded calls.
 */
export function semanticQueryOptions<T>({ kind, title, dax, parse, target }: SemanticQuerySpec<T>) {
  return queryOptions({
    queryKey: [...DAX_QUERY_KEY, kind, target?.datasetId ?? 'default', dax] as const,
    queryFn: async ({ signal }) => parse(await executeDax(title, dax, signal, target)),
    staleTime: DAX_STALE_TIME,
  });
}

/** Keeps showing the previous result (flagged as placeholder) while the new filters load. */
export function useSemanticQuery<T>(spec: SemanticQuerySpec<T>) {
  return useQuery({ ...semanticQueryOptions(spec), placeholderData: keepPreviousData });
}
