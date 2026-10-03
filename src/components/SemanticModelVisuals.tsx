import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Zap,
  RotateCw,
  Sliders,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Copy,
  Check,
  Terminal,
  Calendar,
  TrendingUp,
  Cpu,
  X,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { VoiceBriefingOrb } from './VoiceBriefingOrb';

interface KpiData {
  totalAssets: number;
  totalAssessed: number;
  dueForRenewal: number;
  avgBaseLife: number;
  pctAssessed: number;
}

interface GroupRow {
  group: string;
  count: number;
  assessed: number;
  dueForRenewal: number;
  pctAssessed: number;
}

interface ClassRow {
  className: string;
  count: number;
  assessed: number;
  dueForRenewal: number;
  pctAssessed: number;
}

interface QueryLog {
  title: string;
  dax: string;
  durationMs: number;
  rowCount: number;
  timestamp: string;
}

const AVAILABLE_GROUPS = [
  'Utility_Line',
  'Utility_Point',
  'Core',
  'Transport',
  'rd_line',
];

export const SemanticModelVisuals: React.FC = () => {
  // Cross-Filter States
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [kpiFilter, setKpiFilter] = useState<'all' | 'renewal' | 'assessed'>('all');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [lastLatency, setLastLatency] = useState<number>(0);
  const [showDaxInspector, setShowDaxInspector] = useState<boolean>(false);
  const [copiedDax, setCopiedDax] = useState<boolean>(false);

  // Data states
  const [kpis, setKpis] = useState<KpiData>({
    totalAssets: 0,
    totalAssessed: 0,
    dueForRenewal: 0,
    avgBaseLife: 0,
    pctAssessed: 0,
  });
  const [groupBreakdown, setGroupBreakdown] = useState<GroupRow[]>([]);
  const [classBreakdown, setClassBreakdown] = useState<ClassRow[]>([]);
  const [queryLogs, setQueryLogs] = useState<QueryLog[]>([]);

  // Custom DAX runner state
  const [customDax, setCustomDax] = useState<string>(
    `EVALUATE\nTOPN(\n  10,\n  SUMMARIZECOLUMNS(\n    'asset_type'[asset_type],\n    "AssetCount", [Asset Count (All States)]\n  ),\n  [AssetCount],\n  DESC\n)`
  );
  const [customResult, setCustomResult] = useState<any[] | null>(null);
  const [customLoading, setCustomLoading] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Helper to run query via Express backend
  const executeDax = async (queryTitle: string, dax: string) => {
    const start = performance.now();
    const res = await fetch('/api/powerbi/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: dax }),
    });

    const data = await res.json();
    const duration = Math.round(performance.now() - start);

    if (!res.ok || !data.success) {
      throw new Error(data.error || data.details?.message || 'Query execution failed');
    }

    const log: QueryLog = {
      title: queryTitle,
      dax: dax.trim(),
      durationMs: data.executionTimeMs || duration,
      rowCount: data.rowCount ?? data.rows?.length ?? 0,
      timestamp: new Date().toLocaleTimeString(),
    };

    setQueryLogs((prev) => [log, ...prev.slice(0, 9)]);
    setLastLatency(log.durationMs);

    return { rows: data.rows as any[], duration: log.durationMs };
  };

  // Main data loader based on active cross-filters
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Build dynamic TREATAS filter clauses based on active cross-filters
      const filterClauses: string[] = [];
      if (selectedGroup) {
        filterClauses.push(`TREATAS({"${selectedGroup}"}, 'asset_class_group'[Asset_Class_Group])`);
      }
      if (selectedClass) {
        filterClauses.push(`TREATAS({"${selectedClass}"}, 'asset_class'[Asset_Class])`);
      }

      const kpiFilterStr = filterClauses.length > 0 ? `${filterClauses.join(',\n')},` : '';

      // 1. KPI DAX Query (respects Group and Class cross-filters)
      const kpiDax = `
        EVALUATE
        SUMMARIZECOLUMNS(
          ${kpiFilterStr}
          "TotalAssets", [Asset Count (All States)],
          "TotalAssessed", [Assets Assessed For Condition],
          "DueForRenewal", [Assets Due For Renewal],
          "AvgBaseLife", [Avg Base Life (Years)],
          "PctAssessed", [% Assessed For Condition]
        )
      `;

      // 2. Groups Breakdown DAX Query (always reflects groups, or filters if class selected)
      const groupFilterStr = selectedClass
        ? `TREATAS({"${selectedClass}"}, 'asset_class'[Asset_Class]),`
        : '';
      const groupsDax = `
        EVALUATE
        SUMMARIZECOLUMNS(
          'asset_class_group'[Asset_Class_Group],
          ${groupFilterStr}
          "AssetCount", [Asset Count (All States)],
          "Assessed", [Assets Assessed For Condition],
          "DueForRenewal", [Assets Due For Renewal]
        )
      `;

      // 3. Classes Breakdown DAX Query (filters by selectedGroup if present)
      const classFilterStr = selectedGroup
        ? `TREATAS({"${selectedGroup}"}, 'asset_class_group'[Asset_Class_Group]),`
        : '';
      const classesDax = `
        EVALUATE
        TOPN(
          35,
          SUMMARIZECOLUMNS(
            'asset_class'[Asset_Class],
            ${classFilterStr}
            "AssetCount", [Asset Count (All States)],
            "Assessed", [Assets Assessed For Condition],
            "DueForRenewal", [Assets Due For Renewal]
          ),
          [AssetCount],
          DESC
        )
      `;

      // Query Semantic Model via Service Principal
      const [kpiRes, groupsRes, classesRes] = await Promise.all([
        executeDax(
          `KPIs (${selectedGroup || 'All Groups'}${selectedClass ? ` > ${selectedClass}` : ''})`,
          kpiDax
        ),
        executeDax('Asset Groups Summary', groupsDax),
        executeDax(`Top Classes (${selectedGroup || 'Global'})`, classesDax),
      ]);

      // Parse KPIs
      if (kpiRes.rows.length > 0) {
        const row = kpiRes.rows[0];
        const total = row['[TotalAssets]'] || 0;
        const assessed = row['[TotalAssessed]'] || 0;
        const due = row['[DueForRenewal]'] || 0;
        const life = row['[AvgBaseLife]'] || 0;
        const pct = row['[PctAssessed]'] || (total > 0 ? assessed / total : 0);

        setKpis({
          totalAssets: total,
          totalAssessed: assessed,
          dueForRenewal: due,
          avgBaseLife: parseFloat(Number(life).toFixed(1)),
          pctAssessed: pct,
        });
      } else {
        setKpis({ totalAssets: 0, totalAssessed: 0, dueForRenewal: 0, avgBaseLife: 0, pctAssessed: 0 });
      }

      // Parse Groups
      const parsedGroups: GroupRow[] = groupsRes.rows.map((r: any) => {
        const count = r['[AssetCount]'] || 0;
        const assessed = r['[Assessed]'] || 0;
        return {
          group: r['asset_class_group[Asset_Class_Group]'] || 'Unknown',
          count,
          assessed,
          dueForRenewal: r['[DueForRenewal]'] || 0,
          pctAssessed: count > 0 ? assessed / count : 0,
        };
      });
      parsedGroups.sort((a, b) => b.count - a.count);
      setGroupBreakdown(parsedGroups);

      // Parse Classes
      const parsedClasses: ClassRow[] = classesRes.rows.map((r: any) => {
        const count = r['[AssetCount]'] || 0;
        const assessed = r['[Assessed]'] || 0;
        return {
          className: r['asset_class[Asset_Class]'] || 'Unknown',
          count,
          assessed,
          dueForRenewal: r['[DueForRenewal]'] || 0,
          pctAssessed: count > 0 ? assessed / count : 0,
        };
      });
      setClassBreakdown(parsedClasses);
    } catch (err: any) {
      console.error('Error loading semantic data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-run DAX queries whenever cross-filters change
  useEffect(() => {
    loadDashboardData();
  }, [selectedGroup, selectedClass]);

  // Execute custom DAX from inspector
  const handleRunCustomDax = async () => {
    setCustomLoading(true);
    setCustomError(null);
    setCustomResult(null);
    try {
      const res = await executeDax('Custom DAX Playground', customDax);
      setCustomResult(res.rows);
    } catch (err: any) {
      setCustomError(err.message || 'Error executing DAX');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleCopyDax = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDax(true);
    setTimeout(() => setCopiedDax(false), 2000);
  };

  // Cross-Filter Toggle Handlers
  const handleGroupToggle = (group: string) => {
    if (selectedGroup === group) {
      setSelectedGroup(null);
    } else {
      setSelectedGroup(group);
      setSelectedClass(null); // Reset child class when parent group changes
    }
  };

  const handleClassToggle = (className: string) => {
    if (selectedClass === className) {
      setSelectedClass(null);
    } else {
      setSelectedClass(className);
    }
  };

  const handleClearAllFilters = () => {
    setSelectedGroup(null);
    setSelectedClass(null);
    setKpiFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = Boolean(selectedGroup || selectedClass || kpiFilter !== 'all');

  // Filtered classes according to search & KPI cross-filter
  const filteredClasses = useMemo(() => {
    return classBreakdown.filter((c) => {
      // 1. Text search
      if (searchQuery.trim() && !c.className.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // 2. KPI Card Cross-Filter
      if (kpiFilter === 'renewal') {
        return c.dueForRenewal > 0;
      }
      if (kpiFilter === 'assessed') {
        return c.assessed > 0;
      }
      return true;
    });
  }, [classBreakdown, searchQuery, kpiFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      {/* Top Banner & Telemetry Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Direct Semantic Model Visuals (React)
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live VertiPaq DAX
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <Filter className="w-3 h-3 text-blue-600" />
                Cross-Filtering Enabled
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Model: <strong className="font-medium text-slate-700">AssetFinda_Financial_Master_Suite</strong></span>
              <span>•</span>
              <span className="font-mono text-[11px]">0db033d0...e2ec</span>
              <span>•</span>
              <span className="text-teal-600 font-medium">Auth: Service Principal (Entra ID)</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Latency Badge */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Round-Trip Latency:</span>
            <span className="font-mono font-bold text-slate-900">
              {lastLatency ? `${lastLatency} ms` : '—'}
            </span>
          </div>

          <button
            onClick={() => setShowDaxInspector(!showDaxInspector)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              showDaxInspector
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showDaxInspector ? 'Hide DAX' : 'DAX Inspector'}</span>
          </button>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Cross-Filter Controls & Active Filter Badges */}
      <div className="bg-slate-50 border-b border-slate-200/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-1 shrink-0">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Cross-Filter by Group:</span>
          </div>

          <button
            onClick={() => {
              setSelectedGroup(null);
              setSelectedClass(null);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              !selectedGroup
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            All Asset Groups
          </button>

          {AVAILABLE_GROUPS.map((grp) => {
            const isSelected = selectedGroup === grp;
            return (
              <button
                key={grp}
                onClick={() => handleGroupToggle(grp)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {grp}
              </button>
            );
          })}
        </div>

        {/* Active Filter Chips / Clear Button */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Filters:
            </span>

            {selectedGroup && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-300">
                Group: <strong>{selectedGroup}</strong>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="hover:text-teal-950 p-0.5 cursor-pointer"
                  title="Remove group filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedClass && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                Class: <strong>{selectedClass}</strong>
                <button
                  onClick={() => setSelectedClass(null)}
                  className="hover:text-indigo-950 p-0.5 cursor-pointer"
                  title="Remove class filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {kpiFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                Focus: <strong>{kpiFilter === 'renewal' ? 'Due for Renewal' : 'Condition Assessed'}</strong>
                <button
                  onClick={() => setKpiFilter('all')}
                  className="hover:text-amber-950 p-0.5 cursor-pointer"
                  title="Reset KPI filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={handleClearAllFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline ml-1 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 flex-1">
        {/* KPI Cards Grid (Clickable for Cross-Filtering!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Assets */}
          <div
            onClick={() => setKpiFilter('all')}
            className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none ${
              kpiFilter === 'all'
                ? 'border-blue-400 ring-2 ring-blue-400/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to reset KPI focus to All Assets"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Assets
              </span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {loading ? '...' : kpis.totalAssets.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {selectedClass ? 'in selected class' : selectedGroup ? 'in group' : 'in register'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">
              DAX: <code className="text-slate-600 font-mono">[Asset Count (All States)]</code>
            </p>
          </div>

          {/* 2. Condition Assessed (Click to cross-filter table!) */}
          <div
            onClick={() => setKpiFilter(kpiFilter === 'assessed' ? 'all' : 'assessed')}
            className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none ${
              kpiFilter === 'assessed'
                ? 'border-emerald-500 ring-2 ring-emerald-400/20 bg-emerald-50/20'
                : 'border-slate-200 hover:border-emerald-300'
            }`}
            title="Click to cross-filter classes with condition assessments"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Condition Assessed
              </span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {loading ? '...' : kpis.totalAssessed.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {(kpis.pctAssessed * 100).toFixed(1)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, kpis.pctAssessed * 100))}%` }}
              />
            </div>
          </div>

          {/* 3. Due For Renewal (Click to cross-filter table!) */}
          <div
            onClick={() => setKpiFilter(kpiFilter === 'renewal' ? 'all' : 'renewal')}
            className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none ${
              kpiFilter === 'renewal'
                ? 'border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20'
                : 'border-slate-200 hover:border-amber-300'
            }`}
            title="Click to cross-filter classes requiring urgent renewal"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Due For Renewal
              </span>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {loading ? '...' : kpis.dueForRenewal.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Urgent Action
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">
              DAX: <code className="text-slate-600 font-mono">[Assets Due For Renewal]</code>
            </p>
          </div>

          {/* 4. Avg Base Life */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Avg Base Life
              </span>
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {loading ? '...' : `${kpis.avgBaseLife}`}
              </span>
              <span className="text-xs font-medium text-slate-500">Years</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">
              DAX: <code className="text-slate-600 font-mono">[Avg Base Life (Years)]</code>
            </p>
          </div>
        </div>

        {/* Visuals Row: Visual 1 (Group Distribution) + Visual 2 (Class Hierarchy) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Visual 1: Distribution by Asset Class Group (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  Asset Distribution by Group
                </h3>
                <p className="text-xs text-slate-500">
                  ⚡ Click any bar to cross-filter the classes and KPIs
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {groupBreakdown.length} groups
              </span>
            </div>

            <div className="space-y-3.5 flex-1">
              {groupBreakdown.map((grp) => {
                const isSelected = selectedGroup === grp.group;
                const isDimmed = selectedGroup !== null && !isSelected;
                const maxCount = groupBreakdown[0]?.count || 1;
                const barWidth = Math.max(5, (grp.count / maxCount) * 100);

                return (
                  <div
                    key={grp.group}
                    onClick={() => handleGroupToggle(grp.group)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-2 ring-teal-500/20'
                        : isDimmed
                        ? 'border-slate-100 bg-slate-50/40 opacity-60 hover:opacity-100 hover:border-slate-300'
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{grp.group}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                            Cross-Filtered
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-slate-900 font-bold">
                          {grp.count.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          ({((grp.count / (kpis.totalAssets || 1)) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Animated Bar with Dimming / Highlighting */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isSelected ? 'bg-teal-600' : isDimmed ? 'bg-slate-300' : 'bg-slate-400'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Secondary Metrics */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
                      <span>
                        Assessed:{' '}
                        <strong className="text-slate-700">
                          {grp.assessed.toLocaleString()}
                        </strong>{' '}
                        ({(grp.pctAssessed * 100).toFixed(0)}%)
                      </span>
                      <span>
                        Renewal:{' '}
                        <strong className={grp.dueForRenewal > 0 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                          {grp.dueForRenewal.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual 2: Class Breakdown & Condition Health (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-600" />
                  Asset Classes ({selectedGroup || 'Global Scope'})
                </h3>
                <p className="text-xs text-slate-500">
                  ⚡ Click any row to cross-filter KPIs down to that specific class
                </p>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter class..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-200 focus:outline-none focus:border-teal-500 w-44 bg-slate-50"
                />
              </div>
            </div>

            {/* Table / List with Click-to-Cross-Filter */}
            <div className="flex-1 overflow-y-auto max-h-[440px] rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 font-semibold z-10">
                  <tr>
                    <th className="py-2.5 px-3">Asset Class</th>
                    <th className="py-2.5 px-3 text-right">Inventory</th>
                    <th className="py-2.5 px-3 text-right">Condition Assessed</th>
                    <th className="py-2.5 px-3 text-right">Renewal Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
                          <span>Executing VertiPaq DAX query...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No asset classes matched the current cross-filters.
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((cls) => {
                      const isRowSelected = selectedClass === cls.className;

                      return (
                        <tr
                          key={cls.className}
                          onClick={() => handleClassToggle(cls.className)}
                          className={`transition-colors cursor-pointer select-none ${
                            isRowSelected
                              ? 'bg-indigo-50/80 font-semibold text-indigo-900 border-l-4 border-l-indigo-600'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-2.5 px-3 flex items-center gap-2">
                            {isRowSelected && (
                              <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            )}
                            <span className={isRowSelected ? 'text-indigo-950 font-bold' : 'text-slate-900 font-medium'}>
                              {cls.className}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                            {cls.count.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {cls.assessed.toLocaleString()}{' '}
                            <span className="text-[10px] text-slate-400">
                              ({(cls.pctAssessed * 100).toFixed(0)}%)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {cls.dueForRenewal > 0 ? (
                              <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                {cls.dueForRenewal.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {cls.dueForRenewal > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Renewal
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Healthy
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* DAX Performance Inspector & Custom Query Runner */}
        {showDaxInspector && (
          <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-5 shadow-xl animate-in slide-in-from-bottom duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white">
                  DAX Performance Inspector & Custom Query Runner
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Endpoint:</span>
                <code className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-teal-300 font-mono">
                  POST /api/powerbi/query
                </code>
              </div>
            </div>

            {/* Custom DAX Query Runner */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Execute any DAX query directly against VertiPaq in real time:
                </label>
                <button
                  onClick={() => handleCopyDax(customDax)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedDax ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDax ? 'Copied' : 'Copy DAX'}</span>
                </button>
              </div>

              <textarea
                value={customDax}
                onChange={(e) => setCustomDax(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-teal-300 focus:outline-none focus:border-teal-500"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-slate-400">
                  Tip: Use <code className="text-teal-400">EVALUATE SUMMARIZECOLUMNS(...)</code> or <code className="text-teal-400">EVALUATE ROW(...)</code>
                </div>
                <button
                  onClick={handleRunCustomDax}
                  disabled={customLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${customLoading ? 'animate-spin' : ''}`} />
                  <span>{customLoading ? 'Executing...' : 'Execute DAX'}</span>
                </button>
              </div>

              {customError && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg">
                  <strong>Error:</strong> {customError}
                </div>
              )}

              {customResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto max-h-48 text-[11px] font-mono text-slate-300">
                  <div className="text-xs text-emerald-400 font-bold mb-1">
                    ✓ {customResult.length} rows returned as raw JSON:
                  </div>
                  <pre>{JSON.stringify(customResult, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Recent Queries Log */}
            <div className="border-t border-slate-800 pt-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Recent DAX Query History & Latency
              </h4>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {queryLogs.map((log, idx) => (
                  <div
                    key={idx}
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
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-bold">
                        {log.durationMs} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Voice Briefing Orb (Inspired by assisted-report) */}
      <VoiceBriefingOrb
        kpis={kpis}
        selectedGroup={selectedGroup}
        selectedClass={selectedClass}
        onSelectGroup={setSelectedGroup}
        onSelectClass={setSelectedClass}
        onSetKpiFilter={setKpiFilter}
        onResetAll={handleClearAllFilters}
      />
    </div>
  );
};

export default SemanticModelVisuals;
