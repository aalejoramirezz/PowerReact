import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Terminal, Zap } from 'lucide-react';
import { errorMessage } from '../../api/http';
import { executeDax } from '../../hooks/useSemanticQuery';
import { useDaxLogStore } from '../../store/daxLog';

const DEFAULT_DAX = `EVALUATE
TOPN(
  10,
  SUMMARIZECOLUMNS(
    'asset_type'[asset_type],
    "AssetCount", [Asset Count (All States)]
  ),
  [AssetCount],
  DESC
)`;

export const DaxInspector: React.FC = () => {
  const logs = useDaxLogStore((s) => s.logs);
  const [customDax, setCustomDax] = useState(DEFAULT_DAX);
  const [copied, setCopied] = useState(false);

  const runner = useMutation({
    mutationFn: (dax: string) => executeDax('Custom DAX Playground', dax),
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(customDax);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-5 shadow-xl animate-in slide-in-from-bottom duration-200 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">DAX Performance Inspector & Custom Query Runner</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Endpoint:</span>
          <code className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-teal-300 font-mono">
            POST /api/powerbi/query
          </code>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="custom-dax" className="text-xs font-semibold text-slate-300">
            Execute any DAX query directly against VertiPaq in real time:
          </label>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy DAX'}</span>
          </button>
        </div>

        <textarea
          id="custom-dax"
          value={customDax}
          onChange={(e) => setCustomDax(e.target.value)}
          rows={5}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-teal-300 focus:outline-none focus:border-teal-500"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-400">
            Tip: Use <code className="text-teal-400">EVALUATE SUMMARIZECOLUMNS(...)</code> or{' '}
            <code className="text-teal-400">EVALUATE ROW(...)</code>
          </div>
          <button
            type="button"
            onClick={() => runner.mutate(customDax)}
            disabled={runner.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${runner.isPending ? 'animate-spin' : ''}`} />
            <span>{runner.isPending ? 'Executing...' : 'Execute DAX'}</span>
          </button>
        </div>

        {runner.isError && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg">
            <strong>Error:</strong> {errorMessage(runner.error)}
          </div>
        )}

        {runner.isSuccess && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto max-h-48 text-[11px] font-mono text-slate-300">
            <div className="text-xs text-emerald-400 font-bold mb-1">
              ✓ {runner.data.length} rows returned as raw JSON:
            </div>
            <pre>{JSON.stringify(runner.data, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-3">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Recent DAX Query History & Latency
        </h4>
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {logs.length === 0 && <div className="text-xs text-slate-500 italic">No queries executed yet.</div>}
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 font-medium text-slate-200">
                  <span>{log.title}</span>
                  <span className="text-[10px] text-slate-500">[{log.timestamp}]</span>
                </div>
                <pre className="text-[10px] text-teal-400/90 font-mono mt-1 truncate">
                  {log.dax.replace(/\s+/g, ' ')}
                </pre>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                <span className="text-slate-400">{log.rowCount} rows</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-bold">{log.durationMs} ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
