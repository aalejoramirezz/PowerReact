import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileJson, Upload } from 'lucide-react';
import { errorMessage, getJson } from '../api/http';
import { ManifestDashboard } from '../components/manifest/ManifestDashboard';
import type { DataSourceMode } from '../components/manifest/ManifestVisual';
import { ReportTemplate } from '../components/template/ReportTemplate';
import { Card } from '../components/ui/Card';
import { ErrorNote, LoadingState, Tab, Tabs } from '../components/ui/primitives';
import { validateManifestText, type ManifestValidation } from '../lib/manifest/schema';
import { useThemeStore } from '../store/theme';

interface ManifestIndex {
  manifests: Array<{ id: string; title: string; file: string }>;
}

/** Largest manifest the preview accepts (a manifest is configuration, not data). */
const MAX_UPLOAD_BYTES = 2_000_000;

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

/**
 * /manifest-preview: the harness for manifests produced by Univerus-Lens (or written by hand).
 * Pick a bundled manifest or upload one, validate it against the schema, and render it Live (the
 * manifest's DAX against its semantic model) or from its Sample rows (no network).
 */
export const ManifestPreview: React.FC = () => {
  const setTheme = useThemeStore((s) => s.setTheme);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; text: string; tooLarge?: boolean } | null>(null);
  const [source, setSource] = useState<DataSourceMode>('live');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useQuery({
    queryKey: ['manifests', 'index'],
    queryFn: ({ signal }) => getJson<ManifestIndex>('/manifests/index.json', signal),
    staleTime: Infinity,
  });
  const file = selectedFile ?? index.data?.manifests[0]?.file ?? null;
  const bundled = useQuery({
    queryKey: ['manifests', 'file', file],
    queryFn: ({ signal }) => fetchText(`/manifests/${file}`, signal),
    enabled: Boolean(file) && !upload,
    staleTime: Infinity,
  });

  const origin = upload ? `upload:${upload.name}` : `bundled:${file ?? ''}`;
  const validation: ManifestValidation | null = useMemo(() => {
    if (upload?.tooLarge) return { ok: false, issues: [{ path: '(root)', message: `${upload.name} is larger than 2 MB: a manifest is configuration, not data` }] };
    if (upload) return validateManifestText(upload.text);
    return bundled.data === undefined ? null : validateManifestText(bundled.data);
  }, [upload, bundled.data]);

  // A manifest's theme applies once, when it loads; after that the user's toggle wins
  const themedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!validation?.ok) return;
    const key = `${origin}:${validation.manifest.id}`;
    if (themedFor.current === key) return;
    themedFor.current = key;
    if (validation.manifest.theme !== 'auto') setTheme(validation.manifest.theme);
  }, [validation, origin, setTheme]);

  const readFile = async (picked: File) => {
    if (picked.size > MAX_UPLOAD_BYTES) {
      setUpload({ name: picked.name, text: '', tooLarge: true });
      return;
    }
    setUpload({ name: picked.name, text: await picked.text() });
  };

  const controls = (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2">
      {/* Capped at the toolbar's width: the manifest list scrolls instead of widening the page */}
      <div className="flex min-w-0 max-w-full items-center gap-3">
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-u-label @md:flex">
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          Manifest
        </span>
        <Tabs label="Manifest" className="u-scroll-x min-w-0">
          {(index.data?.manifests ?? []).map((m) => (
            <Tab
              key={m.file}
              active={!upload && file === m.file}
              onClick={() => {
                setUpload(null);
                setSelectedFile(m.file);
              }}
            >
              {m.title}
            </Tab>
          ))}
          {upload && <Tab active>{upload.name}</Tab>}
        </Tabs>
      </div>
      <Tabs label="Data source">
        <Tab active={source === 'live'} onClick={() => setSource('live')} title="The manifest's DAX against its semantic model">
          Live
        </Tab>
        <Tab active={source === 'sample'} onClick={() => setSource('sample')} title="The manifest's sample rows, no network">
          Sample
        </Tab>
      </Tabs>
    </div>
  );

  const actions = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Upload a manifest"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void readFile(picked);
          e.target.value = '';
        }}
      />
      <button type="button" className="u-btn-ghost" aria-label="Upload" title="Upload a manifest (.json)" onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden @lg/plane:inline">Upload</span>
      </button>
      <a className="u-btn-ghost" href="/manifests/manifest.schema.json" download="manifest.schema.json" aria-label="Download schema" title="Download the manifest JSON Schema">
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden @lg/plane:inline">Schema</span>
      </a>
    </>
  );

  let content: React.ReactNode;
  if (validation?.ok) {
    content = (
      <ManifestDashboard key={`${origin}:${validation.manifest.id}:${source}`} manifest={validation.manifest} source={source} actions={actions} controls={controls} />
    );
  } else {
    const loadError = index.error ?? bundled.error;
    content = (
      <ReportTemplate eyebrow="Manifest preview" title={upload?.name ?? 'Manifest Preview'} actions={actions} toolbar={controls}>
        {validation && !validation.ok ? (
          <Card className="max-w-[900px]" data-testid="manifest-issues" role="alert">
            <h3 className="u-card-title">This manifest is not valid</h3>
            <p className="u-card-subtitle mt-1">
              {validation.issues.length} {validation.issues.length === 1 ? 'problem' : 'problems'}. Fix them and upload it again; the JSON
              Schema (Schema button) describes every field.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {validation.issues.slice(0, 50).map((issue, i) => (
                <li key={`${issue.path}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-u-text-soft">
                  <code className="rounded bg-u-track px-1.5 py-0.5 font-mono text-[11.5px] text-u-title">{issue.path}</code>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : loadError ? (
          <ErrorNote error={new Error(errorMessage(loadError))} />
        ) : (
          <LoadingState label="Loading the manifest..." rows={4} />
        )}
      </ReportTemplate>
    );
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="manifest-preview"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) void readFile(dropped);
      }}
    >
      {content}
      {dragging && (
        <div className="u-anim-fade pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-[var(--u-plane-radius)] border-2 border-dashed border-u-interaction bg-u-panel-bg text-[14px] font-semibold text-u-title">
          Drop a manifest (.json) to preview it
        </div>
      )}
    </div>
  );
};

export default ManifestPreview;
