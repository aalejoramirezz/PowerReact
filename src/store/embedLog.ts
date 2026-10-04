import { create } from 'zustand';

interface EmbedLogState {
  logs: string[];
  clear: () => void;
}

const MAX_LOGS = 50;

/** Diagnostics stream for the Power BI embed (SDK events, token lifecycle). */
export const useEmbedLogStore = create<EmbedLogState>()((set) => ({
  logs: [],
  clear: () => set({ logs: [] }),
}));

export function logEmbed(message: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  useEmbedLogStore.setState((s) => ({ logs: [line, ...s.logs].slice(0, MAX_LOGS) }));
}
