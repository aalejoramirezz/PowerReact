import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as pbi from 'powerbi-client';
import { AlertCircle, ExternalLink, FileSpreadsheet, Maximize2, RotateCw, Sliders, Terminal } from 'lucide-react';
import { ApiError, errorMessage } from '../../api/http';
import { useLatestRef } from '../../hooks/useLatestRef';
import { logEmbed, useEmbedLogStore } from '../../store/embedLog';
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
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 overflow-hidden">
      {/* Slim Light Sub-bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <label htmlFor="report-select" className="font-semibold text-xs text-slate-800">
              Report:
            </label>
            <select
              id="report-select"
              value={selection.code}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="text-xs bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-800 rounded-md px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {(preconfigured.data ?? []).map((p) => (
                <option key={p.id} value={p.code}>
                  {p.description} ({p.type === 'PaginatedReport' ? 'Paginated RDL' : 'Interactive PBI'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium">
            Active: {config?.tokenType || 'Service Principal'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleReload}
            disabled={isLoading}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
            title="Reload Report"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            disabled={isPaginated}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
              showFilters
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Toggle Filter Pane"
          >
            <Sliders className="w-3 h-3" />
            <span>Filters</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNav(!showNav)}
            disabled={isPaginated}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
              showNav
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Toggle Page Navigation"
          >
            <span>Navigation</span>
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
              showLogs
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 relative flex flex-col bg-[#f8fafc]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm font-medium text-slate-700">Generating Service Principal Embed Token...</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">Workspace: {selection.workspaceId}</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="m-4 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-red-300">{error.message}</div>
                {error instanceof ApiError && error.hint && (
                  <div className="text-xs text-slate-300 bg-red-900/30 p-2 rounded">{error.hint}</div>
                )}
                {error instanceof ApiError && error.details !== undefined ? (
                  <pre className="text-[11px] font-mono bg-black/40 p-2 rounded overflow-auto max-h-32 text-red-200">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                ) : (
                  !(error instanceof ApiError) && <div className="text-xs">{errorMessage(error)}</div>
                )}
                <button
                  type="button"
                  onClick={() => void embedQuery.refetch()}
                  className="mt-2 px-3 py-1 text-xs font-semibold rounded-md bg-red-900/60 hover:bg-red-900 text-red-100 border border-red-700 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!config && !isLoading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select a Report to Embed</h3>
            <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
              Embed Power BI interactive dashboards or paginated reports directly using the Univerus Service Principal.
            </p>
          </div>
        )}

        {/* Power BI Container */}
        <div
          ref={containerRef}
          className={`flex-1 w-full h-full min-h-[500px] bg-[#f8fafc] transition-opacity ${
            config ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ minHeight: '600px' }}
        />

        {/* Live Diagnostics & Event Drawer */}
        {showLogs && (
          <div className="h-44 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-slate-200">Power BI SDK Event Stream & Diagnostics</span>
                {config && (
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono">
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
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open in Power BI</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button type="button" onClick={clearLogs} className="text-[11px] text-slate-400 hover:text-white">
                  Clear Logs
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">No events logged yet. Embed a report to begin listening...</div>
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
