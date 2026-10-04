import { create } from 'zustand';

export interface QueryLog {
  id: number;
  title: string;
  dax: string;
  durationMs: number;
  rowCount: number;
  timestamp: string;
}

interface DaxLogState {
  logs: QueryLog[];
  lastLatencyMs: number | null;
  record: (log: Omit<QueryLog, 'id' | 'timestamp'>) => void;
}

const MAX_LOGS = 10;
let nextId = 0;

export const useDaxLogStore = create<DaxLogState>()((set) => ({
  logs: [],
  lastLatencyMs: null,
  record: (log) =>
    set((s) => ({
      logs: [{ ...log, id: nextId++, timestamp: new Date().toLocaleTimeString() }, ...s.logs].slice(0, MAX_LOGS),
      lastLatencyMs: log.durationMs,
    })),
}));
