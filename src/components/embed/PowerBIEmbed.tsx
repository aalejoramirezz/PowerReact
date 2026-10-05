import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as pbi from 'powerbi-client';
import { AlertCircle, ExternalLink, FileSpreadsheet, Maximize2, RotateCw, Sliders, Terminal } from 'lucide-react';
import { ApiError, errorMessage } from '../../api/http';
import { useLatestRef } from '../../hooks/useLatestRef';
import { logEmbed, useEmbedLogStore } from '../../store/embedLog';
import { cx } from '../ui/cx';
import { StatusChip } from '../ui/primitives';
import { embedConfigQuery, preconfiguredReportsQuery, type ReportSelection } from './embedConfigQuery';

// A single Service per module: it owns the embed registry and the postMessage router
const powerbiService = new pbi.service.Service(
  pbi.factories.hpmFactory,
  pbi.factories.wpmpFactory,
  pbi.factories.routerFactory
);

const DEFAULT_SELECTION: ReportSelection = {
  code: 'AssetFinda_Financial_Master_Suite',
  workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
  reportId: '0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e',
  pageName: 'p_m_f1',
};

type SdkEvent<T> = pbi.service.ICustomEvent<T>;

const panesSettings = ({ showFilters, showNav }: { showFilters: boolean; showNav: boolean }) => ({
  filters: { expanded: false, visible: showFilters },
  pageNavigation: { visible: showNav, position: pbi.models.PageNavigationPosition.Left },
});

const describe = (value: unknown) => (value instanceof Error ? value.message : JSON.stringify(value));

export const PowerBIEmbedComponent: React.FC = () => {
  const [selection, setSelection] = useState<ReportSelection>(DEFAULT_SELECTION);
  const [showFilters, setShowFilters] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [embedNonce, setEmbedNonce] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const logs = useEmbedLogStore((s) => s.logs);
  const clearLogs = useEmbedLogStore((s) => s.clear);

  const containerRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<pbi.Report | null>(null);
  const appliedTokenRef = useRef<string | null>(null);

  const preconfigured = useQuery(preconfiguredReportsQuery);
  const embedQuery = useQuery(embedConfigQuery(selection));

  // A failed (re)load must not leave the previous report on screen
  const config = embedQuery.isError ? undefined : embedQuery.data;
  const reportId = config?.reportId;
  const embedUrl = config?.embedUrl;
  const reportName = config?.reportName;
  const tokenType = config?.tokenType;
  const isPaginated = config?.isPaginated ?? false;
  const pageName = config?.pageName;
  const accessToken = config?.accessToken;
  const expiration = config?.expiration;

  // Read inside the embed effect without re-embedding when they change
  const accessTokenRef = useLatestRef(accessToken);
  const panesRef = useLatestRef({ showFilters, showNav });
  const refetchRef = useLatestRef(embedQuery.refetch);

  // Embed once per report identity; cleanup tears the iframe down
  useEffect(() => {
    const container = containerRef.current;
    const token = accessTokenRef.current;
    if (!container || !reportId || !embedUrl || !tokenType || !token) return;

    const { models } = pbi;
    const base = {
      type: 'report',
      id: reportId,
      embedUrl,
      accessToken: token,
      tokenType: tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
    };
    const embedConfig: pbi.IEmbedConfiguration = isPaginated
      ? { ...base, settings: { commands: { parameterPanel: { enabled: true, expanded: true } } } }
      : {
          ...base,
          pageName,
          viewMode: models.ViewMode.View,
          settings: {
            panes: panesSettings(panesRef.current),
            background: models.BackgroundType.Transparent,
            layoutType: models.LayoutType.Master,
          },
        };

    logEmbed(`Initializing Power BI client embed for "${reportName}"${isPaginated ? ' (Paginated RDL)' : ''}`);

    let report: pbi.Report;
    try {
      report = powerbiService.embed(container, embedConfig) as pbi.Report;
    } catch (err) {
      logEmbed(`Initialization Error: ${describe(err)}`);
      return;
    }
    reportRef.current = report;
    appliedTokenRef.current = token;

    report.on('loaded', () => {
      logEmbed(`Event: ${isPaginated ? 'Paginated Report' : 'Report'} loaded`);
      // Pane toggles made while the report was loading
      if (!isPaginated) void report.updateSettings({ panes: panesSettings(panesRef.current) }).catch(() => {});
    });
    report.on('rendered', () => logEmbed(`Event: ${isPaginated ? 'Paginated Report' : 'Report'} rendered`));
    report.on('pageChanged', (event: SdkEvent<{ newPage?: { name: string; displayName?: string } }>) => {
      const page = event.detail.newPage;
      logEmbed(`Event: Page changed -> "${page?.displayName || page?.name}"`);
    });
    report.on('error', (event: SdkEvent<pbi.models.IError>) => {
      logEmbed(`Event Error: ${describe(event.detail?.message ?? event.detail)}`);
      // The SDK reports expiry as an error; renew and hand the new token to the iframe
      if (event.detail?.message === 'TokenExpired') {
        logEmbed('Token expired: requesting a fresh embed token');
        void refetchRef.current();
      }
    });

    return () => {
      powerbiService.reset(container);
      if (reportRef.current === report) reportRef.current = null;
      appliedTokenRef.current = null;
    };
  }, [reportId, embedUrl, reportName, tokenType, isPaginated, pageName, embedNonce, accessTokenRef, panesRef, refetchRef]);

  // Renewed tokens are pushed into the live report instead of re-embedding it
  useEffect(() => {
    const report = reportRef.current;
    if (!report || !accessToken || appliedTokenRef.current === accessToken) return;
    appliedTokenRef.current = accessToken;
    report
      .setAccessToken(accessToken)
      .then(() => logEmbed(`Access token renewed (Expires: ${expiration || 'unknown'})`))
      .catch((err: unknown) => logEmbed(`setAccessToken failed: ${describe(err)}`));
  }, [accessToken, expiration]);

  // Pane toggles update the live report settings
  useEffect(() => {
    const report = reportRef.current;
    if (!report || isPaginated) return;
    report
      .updateSettings({ panes: panesSettings({ showFilters, showNav }) })
      .catch((err: unknown) => logEmbed(`updateSettings failed: ${describe(err)}`));
  }, [showFilters, showNav, isPaginated]);

  const handleSelectPreset = (code: string) => {
    const preset = preconfigured.data?.find((p) => p.code === code);
    if (preset) {
      setSelection({
        code: preset.code,
        workspaceId: preset.workspaceId,
        reportId: preset.reportId,
        pageName: preset.pageName,
      });
    }
  };

  const handleFullscreen = () => {
    if (reportRef.current) reportRef.current.fullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  // Fresh token, then a clean re-embed
  const handleReload = async () => {
    setIsReloading(true);
    try {
      await embedQuery.refetch();
      setEmbedNonce((n) => n + 1);
    } finally {
      setIsReloading(false);
    }
  };

  const isLoading = embedQuery.isLoading || isReloading;
  const error = embedQuery.error;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-u-canvas text-u-text">
      {/* Toolbar: wraps on phones; secondary labels collapse to icons below sm */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-u-panel-border bg-u-panel-bg px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="report-select" className="text-xs font-semibold text-u-title">
              Report:
            </label>
            <select
              id="report-select"
              value={selection.code}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="u-input min-w-0 max-w-[62vw] cursor-pointer !h-7 !px-2.5 sm:max-w-none"
            >
              {(preconfigured.data ?? []).map((p) => (
                <option key={p.id} value={p.code}>
                  {p.description} ({p.type === 'PaginatedReport' ? 'Paginated RDL' : 'Interactive PBI'})
                </option>
              ))}
            </select>
          </div>

          <StatusChip tone="ok" className="max-md:hidden">
            Active: {config?.tokenType || 'Service Principal'}
          </StatusChip>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleReload}
            disabled={isLoading}
            className="u-btn-ghost !h-7 !px-2"
            title="Reload Report"
            aria-label="Reload Report"
          >
            <RotateCw className={cx('h-3.5 w-3.5', isLoading && 'u-spin')} />
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            disabled={isPaginated}
            aria-pressed={showFilters}
            className="u-btn-ghost !h-7 !px-2"
            title="Toggle Filter Pane"
            aria-label="Filters"
          >
            <Sliders className="h-3 w-3" />
            <span className="max-sm:hidden">Filters</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNav(!showNav)}
            disabled={isPaginated}
            aria-pressed={showNav}
            className="u-btn-ghost !h-7 !px-2"
            title="Toggle Page Navigation"
          >
            <span>Navigation</span>
          </button>

          <button type="button" onClick={handleFullscreen} className="u-btn-ghost !h-7 !px-2" title="Fullscreen" aria-label="Fullscreen">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            aria-pressed={showLogs}
            className="u-btn-ghost !h-7 !px-2"
            aria-label="Diagnostics"
          >
            <Terminal className="h-3 w-3" />
            <span className="max-sm:hidden">Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="relative flex flex-1 flex-col bg-u-canvas">
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-u-overlay backdrop-blur-sm" role="status">
            <div className="u-spin h-12 w-12 rounded-full border-4 border-u-track border-t-u-primary" />
            <p className="mt-4 text-sm font-medium text-white">Generating Service Principal Embed Token...</p>
            <p className="mt-1 font-mono text-xs text-white/70">Workspace: {selection.workspaceId}</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="m-4 rounded-[var(--u-card-radius)] border border-u-bad/30 bg-u-bad-bg p-4 text-sm text-u-bad-text" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 space-y-1">
                <div className="font-semibold">{error.message}</div>
                {error instanceof ApiError && error.hint && (
                  <div className="rounded bg-u-card-solid/60 p-2 text-xs text-u-text">{error.hint}</div>
                )}
                {error instanceof ApiError && error.details !== undefined ? (
                  <pre className="max-h-32 overflow-auto rounded bg-u-code-bg p-2 font-mono text-[11px] text-u-code-text">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                ) : (
                  !(error instanceof ApiError) && <div className="text-xs">{errorMessage(error)}</div>
                )}
                <button type="button" onClick={() => void embedQuery.refetch()} className="u-btn-ghost mt-2 !h-7">
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!config && !isLoading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-u-mark-bg text-u-mark-fg">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <h3 className="font-display text-lg font-semibold text-u-title">Select a Report to Embed</h3>
            <p className="mb-6 mt-1 max-w-md text-sm text-u-label">
              Embed Power BI interactive dashboards or paginated reports directly using the Univerus Service Principal.
            </p>
          </div>
        )}

        {/* Power BI container */}
        <div
          ref={containerRef}
          className={cx('h-full min-h-[500px] w-full flex-1 transition-opacity', config ? 'opacity-100' : 'pointer-events-none opacity-0')}
          style={{ minHeight: '600px' }}
        />

        {/* Live diagnostics drawer */}
        {showLogs && (
          <div className="flex h-44 shrink-0 flex-col border-t border-u-code-border bg-u-code-bg text-u-code-text">
            <div className="flex items-center justify-between border-b border-u-code-border px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-u-code-accent" />
                <span className="font-semibold">Power BI SDK Event Stream & Diagnostics</span>
                {config && (
                  <span className="rounded bg-u-code-surface px-2 py-0.5 font-mono text-[10px] text-u-code-accent">
                    Token Active (Expires: {expiration ? new Date(expiration).toLocaleTimeString() : 'N/A'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {config?.webUrl && (
                  <a
                    href={config.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-u-code-accent hover:underline"
                  >
                    <span>Open in Power BI</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button type="button" onClick={clearLogs} className="text-[11px] text-u-code-muted hover:text-u-code-text">
                  Clear Logs
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="italic text-u-code-muted">No events logged yet. Embed a report to begin listening...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={`${index}-${log}`} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
