import React, { useState, useEffect, useRef } from 'react';
import * as pbi from 'powerbi-client';
import {
  RotateCw,
  Maximize2,
  Sliders,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import type { PreconfiguredReport, ReportEmbedConfig } from '../types';

interface PowerBIEmbedProps {
  initialReport?: { workspaceId: string; reportId: string } | null;
}

export const PowerBIEmbedComponent: React.FC<PowerBIEmbedProps> = ({ initialReport }) => {
  const [preconfigured, setPreconfigured] = useState<PreconfiguredReport[]>([]);
  const [selectedReportCode, setSelectedReportCode] = useState<string>('AssetFinda_Financial_Master_Suite');
  const [workspaceId, setWorkspaceId] = useState<string>('ef45c53d-42d4-48c6-be79-380b8d890c80');
  const [reportId, setReportId] = useState<string>('0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e');
  const [currentPageName, setCurrentPageName] = useState<string | undefined>('p_m_f1');

  // Settings
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showNav, setShowNav] = useState<boolean>(false);

  // Embed State
  const [loading, setLoading] = useState<boolean>(false);
  const [embedConfig, setEmbedConfig] = useState<ReportEmbedConfig | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string; details?: any } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const reportObjRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Load preconfigured reports and auto-embed default
  useEffect(() => {
    fetch('/api/powerbi/preconfigured')
      .then((res) => res.json())
      .then((data) => {
        setPreconfigured(data);
      })
      .catch((err) => console.error('Failed to load preconfigured reports:', err));

    if (!initialReport) {
      fetchEmbedConfig('ef45c53d-42d4-48c6-be79-380b8d890c80', '0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e', 'p_m_f1');
    }
  }, []);

  // Sync if initialReport passed from explorer
  useEffect(() => {
    if (initialReport) {
      setSelectedReportCode('AssetFinda_Financial_Master_Suite');
      setWorkspaceId(initialReport.workspaceId);
      setReportId(initialReport.reportId);
      setCurrentPageName('p_m_f1');
      fetchEmbedConfig(initialReport.workspaceId, initialReport.reportId, 'p_m_f1');
    }
  }, [initialReport]);

  // Handle Preset selection
  const handleSelectPreset = (preset: PreconfiguredReport) => {
    setSelectedReportCode(preset.code);
    setWorkspaceId(preset.workspaceId);
    setReportId(preset.reportId);
    setCurrentPageName(preset.pageName);
    fetchEmbedConfig(preset.workspaceId, preset.reportId, preset.pageName);
  };

  // Fetch Embed Config & Token from Express backend
  const fetchEmbedConfig = async (wsId: string, rptId: string, pageName?: string) => {
    setLoading(true);
    setError(null);
    addLog(`Requesting Embed Token for Workspace: ${wsId}, Report: ${rptId}`);

    try {
      const res = await fetch('/api/powerbi/embed-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: wsId, reportId: rptId, pageName }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw { message: data.error || 'Failed to fetch embed config', hint: data.hint, details: data.details };
      }

      setEmbedConfig({
        ...data,
        pageName: pageName || data.pageName,
      });
      addLog(`Embed Token obtained successfully (Type: ${data.tokenType}, Expires: ${data.expiration})`);
    } catch (err: any) {
      console.error('Embed error:', err);
      setError({
        message: err.message || 'Error communicating with embed service',
        hint: err.hint,
        details: err.details,
      });
      addLog(`ERROR: ${err.message || 'Failed to acquire embed token'}`);
    } finally {
      setLoading(false);
    }
  };

  // Embed report when embedConfig changes
  useEffect(() => {
    if (!embedConfig || !containerRef.current) return;

    // Clear previous embed
    if (reportObjRef.current) {
      try {
        const powerbi = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory
        );
        powerbi.reset(containerRef.current);
      } catch (e) {
        console.warn('Error resetting embed container:', e);
      }
    }

    addLog(`Initializing Power BI client embed for "${embedConfig.reportName}"`);

    try {
      const powerbi = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );

      const models = pbi.models;

      // Handle Paginated Reports (RDL)
      if (embedConfig.isPaginated) {
        addLog('Rendering Paginated Report (RDL Embed Mode)');
        const paginatedConfig: pbi.IEmbedConfiguration = {
          type: 'report',
          id: embedConfig.reportId,
          embedUrl: embedConfig.embedUrl,
          accessToken: embedConfig.accessToken,
          tokenType: embedConfig.tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
          settings: {
            commands: {
              parameterPanel: {
                enabled: true,
                expanded: true,
              },
            },
          },
        };

        const report = powerbi.embed(containerRef.current, paginatedConfig);
        reportObjRef.current = report;

        report.on('loaded', () => addLog('Event: Paginated Report loaded'));
        report.on('rendered', () => addLog('Event: Paginated Report rendered successfully'));
        report.on('error', (e: any) => {
          addLog(`Event Error: ${JSON.stringify(e.detail || e)}`);
        });
      } else {
        // Standard Power BI Interactive Report
        const config: pbi.IEmbedConfiguration = {
          type: 'report',
          id: embedConfig.reportId,
          embedUrl: embedConfig.embedUrl,
          accessToken: embedConfig.accessToken,
          tokenType: embedConfig.tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
          pageName: embedConfig.pageName,
          viewMode: models.ViewMode.View,
          settings: {
            panes: {
              filters: {
                expanded: false,
                visible: showFilters,
              },
              pageNavigation: {
                visible: showNav,
                position: models.PageNavigationPosition.Left,
              },
            },
            navContentPaneEnabled: showNav,
            background: models.BackgroundType.Transparent,
            layoutType: models.LayoutType.Master,
          },
        };

        const report = powerbi.embed(containerRef.current, config);
        reportObjRef.current = report;

        report.on('loaded', () => addLog('Event: Report loaded'));
        report.on('rendered', () => addLog('Event: Report rendered'));
        report.on('pageChanged', (e: any) => {
          const page = e.detail?.newPage;
          addLog(`Event: Page changed -> "${page?.displayName || page?.name}"`);
        });
        report.on('error', (e: any) => {
          addLog(`Event Error: ${JSON.stringify(e.detail?.message || e.detail || e)}`);
        });
      }
    } catch (err: any) {
      console.error('Embed initialization error:', err);
      addLog(`Initialization Error: ${err.message}`);
    }
  }, [embedConfig, showFilters, showNav]);

  // Fullscreen helper
  const handleFullscreen = () => {
    if (reportObjRef.current?.fullscreen) {
      reportObjRef.current.fullscreen();
    } else if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  // Reload report
  const handleReload = () => {
    if (workspaceId && reportId) {
      fetchEmbedConfig(workspaceId, reportId, currentPageName);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 overflow-hidden">
      {/* Slim Light Sub-bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex items-center justify-between">
        {/* Left: Report Title & Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs text-slate-800">Report:</span>
            <select
              value={selectedReportCode}
              onChange={(e) => {
                const found = preconfigured.find((p) => p.code === e.target.value);
                if (found) handleSelectPreset(found);
              }}
              className="text-xs bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-800 rounded-md px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {preconfigured.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.description} ({p.type === 'PaginatedReport' ? 'Paginated RDL' : 'Interactive PBI'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium">
            Active: {embedConfig?.tokenType || 'Service Principal'}
          </span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReload}
            disabled={loading}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
            title="Reload Report"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
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
            onClick={() => setShowNav(!showNav)}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
              showNav
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Toggle Page Navigation"
          >
            <span>Navigation</span>
          </button>

          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
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
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm font-medium text-slate-700">Generating Service Principal Embed Token...</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">Workspace: {workspaceId}</p>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="m-4 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-red-300">{error.message}</div>
                {error.hint && <div className="text-xs text-slate-300 bg-red-900/30 p-2 rounded">{error.hint}</div>}
                {error.details && (
                  <pre className="text-[11px] font-mono bg-black/40 p-2 rounded overflow-auto max-h-32 text-red-200">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State before load */}
        {!embedConfig && !loading && !error && (
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
            embedConfig ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                {embedConfig && (
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono">
                    Token Active (Expires: {embedConfig.expiration ? new Date(embedConfig.expiration).toLocaleTimeString() : 'N/A'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {embedConfig?.webUrl && (
                  <a
                    href={embedConfig.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open in Power BI</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Clear Logs
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">No events logged yet. Embed a report to begin listening...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="leading-relaxed">
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
