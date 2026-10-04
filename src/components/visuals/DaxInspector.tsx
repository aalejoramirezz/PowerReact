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

/** Code surface: an inverted slate block in Neo-Glass, a deeper well in Nocturne. */
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
    <section
      className="u-anim-rise space-y-4 border border-u-code-border bg-u-code-bg p-5 text-u-code-text"
      style={{ borderRadius: 'var(--u-card-radius)' }}
      aria-label="DAX Performance Inspector"
    >
      <div className="flex items-center justify-between border-b border-u-code-border pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-u-code-accent" />
          <h3 className="font-display text-[15px] font-semibold">DAX Performance Inspector & Custom Query Runner</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-u-code-muted">Endpoint:</span>
          <code className="rounded bg-u-code-surface px-2 py-0.5 font-mono text-[11px] text-u-code-accent">POST /api/powerbi/query</code>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="custom-dax" className="text-[12px] font-semibold">
            Execute any DAX query directly against VertiPaq in real time:
          </label>
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1 text-[12px] text-u-code-muted hover:text-u-code-text"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-u-code-accent" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy DAX'}</span>
          </button>
        </div>

        <textarea
          id="custom-dax"
          value={customDax}
          onChange={(e) => setCustomDax(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-u-code-border bg-u-code-surface p-3 font-mono text-[12px] text-u-code-accent focus:border-u-code-accent focus:outline-none"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="text-[12px] text-u-code-muted">
            Tip: Use <code className="text-u-code-accent">EVALUATE SUMMARIZECOLUMNS(...)</code> or{' '}
            <code className="text-u-code-accent">EVALUATE ROW(...)</code>
          </div>
          <button type="button" onClick={() => runner.mutate(customDax)} disabled={runner.isPending} className="u-btn">
            <Zap className={`h-3.5 w-3.5 ${runner.isPending ? 'u-spin' : ''}`} />
            <span>{runner.isPending ? 'Executing...' : 'Execute DAX'}</span>
          </button>
        </div>

        {runner.isError && (
          <div className="rounded-lg bg-u-bad-bg p-3 text-[12px] text-u-bad-text">
            <strong>Error:</strong> {errorMessage(runner.error)}
          </div>
        )}

        {runner.isSuccess && (
          <div className="max-h-48 overflow-auto rounded-lg border border-u-code-border bg-u-code-surface p-3 font-mono text-[11px]">
            <div className="mb-1 text-[12px] font-bold text-u-code-accent">✓ {runner.data.length} rows returned as raw JSON:</div>
            <pre>{JSON.stringify(runner.data, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="border-t border-u-code-border pt-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-u-code-muted">
          Recent DAX Query History & Latency
        </h4>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {logs.length === 0 && <div className="text-[12px] italic text-u-code-muted">No queries executed yet.</div>}
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-u-code-border bg-u-code-surface p-2.5 text-[12px]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <span>{log.title}</span>
                  <span className="text-[10px] text-u-code-muted">[{log.timestamp}]</span>
                </div>
                <pre className="mt-1 truncate font-mono text-[10px] text-u-code-accent">{log.dax.replace(/\s+/g, ' ')}</pre>
              </div>
              <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
                <span className="text-u-code-muted">{log.rowCount} rows</span>
                <span className="rounded bg-u-code-bg px-2 py-0.5 font-bold text-u-code-accent">{log.durationMs} ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
