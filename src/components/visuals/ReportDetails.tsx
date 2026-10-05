import React, { useState } from 'react';
import { Check, Code2, Copy, Info } from 'lucide-react';
import { useDaxLogStore } from '../../store/daxLog';
import { Popover } from '../ui/Popover';
import { MODEL_INFO } from './constants';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-u-grid py-2 last:border-b-0">
    <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-u-label">{label}</dt>
    <dd className="min-w-0 text-right text-[12px] text-u-text-soft">{children}</dd>
  </div>
);

/**
 * Technical context on demand: model, engine, auth and query telemetry live behind an ⓘ in the
 * report header instead of on the canvas ("every pixel clarifies data"). Also the entry point to
 * the DAX Inspector.
 */
export const ReportDetails: React.FC<{ onOpenInspector: () => void }> = ({ onOpenInspector }) => {
  const lastLatency = useDaxLogStore((s) => s.lastLatencyMs);
  const total = useDaxLogStore((s) => s.total);
  const [copied, setCopied] = useState(false);

  const copyDatasetId = async () => {
    try {
      await navigator.clipboard.writeText(MODEL_INFO.datasetId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (permissions / insecure context): the id stays visible in the title
    }
  };

  return (
    <Popover
      label="Report details"
      title="Report details"
      triggerClassName="u-btn-ghost"
      trigger={
        <>
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden @lg/plane:inline">Details</span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="u-eyebrow">Semantic model</p>
          <dl className="mt-2">
            <Row label="Model">
              <span className="break-all font-medium text-u-title">{MODEL_INFO.name}</span>
            </Row>
            <Row label="Dataset">
              <button
                type="button"
                onClick={copyDatasetId}
                title={MODEL_INFO.datasetId}
                className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] hover:text-u-interaction"
              >
                {MODEL_INFO.datasetIdShort}
                {copied ? <Check className="h-3 w-3 text-u-ok-text" /> : <Copy className="h-3 w-3" />}
                <span className="sr-only">{copied ? 'Copied' : 'Copy dataset id'}</span>
              </button>
            </Row>
            <Row label="Engine">{MODEL_INFO.engine}</Row>
            <Row label="Auth">{MODEL_INFO.auth}</Row>
            <Row label="Latency">
              <span className="u-num">{lastLatency !== null ? `${lastLatency.toLocaleString()} ms` : '—'}</span>
              <span className="text-u-label"> · last round-trip</span>
            </Row>
            <Row label="Queries">
              <span className="u-num">{total.toLocaleString()}</span>
              <span className="text-u-label"> this session</span>
            </Row>
          </dl>
          <button
            type="button"
            className="u-btn-ghost mt-3 w-full justify-center"
            onClick={() => {
              close();
              onOpenInspector();
            }}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            Open DAX Inspector
          </button>
        </>
      )}
    </Popover>
  );
};
