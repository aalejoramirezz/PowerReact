import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, Calendar, CheckCircle2, Code2, Cpu, Database, Filter, RotateCw, Zap } from 'lucide-react';
import { errorMessage } from '../../api/http';
import { loadDashboard, useDashboardData } from '../../hooks/useDashboardData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DAX_QUERY_KEY } from '../../hooks/useSemanticQuery';
import type { KpiData } from '../../lib/dax/types';
import { useDaxLogStore } from '../../store/daxLog';
import { selectFilters, useFilterStore, type FocusTarget } from '../../store/filters';
import { VoiceBriefingOrb } from '../briefing/VoiceBriefingOrb';
import { ClassTable } from './ClassTable';
import { MODEL_INFO } from './constants';
import { DaxInspector } from './DaxInspector';
import { FilterBar } from './FilterBar';
import { GroupDistribution } from './GroupDistribution';
import { KpiCard } from './KpiCard';

const SEARCH_DEBOUNCE_MS = 300;

interface SemanticModelVisualsProps {
  /** False while the view is kept mounted but hidden behind another route. */
  active?: boolean;
}

export const SemanticModelVisuals: React.FC<SemanticModelVisualsProps> = ({ active = true }) => {
  const queryClient = useQueryClient();
  const filters = useFilterStore(useShallow(selectFilters));
  const actions = useFilterStore(
    useShallow((s) => ({
      toggleGroup: s.toggleGroup,
      toggleClass: s.toggleClass,
      setKpiFocus: s.setKpiFocus,
      toggleKpiFocus: s.toggleKpiFocus,
      setSearch: s.setSearch,
      resetAll: s.resetAll,
    }))
  );
  const lastLatency = useDaxLogStore((s) => s.lastLatencyMs);
  const [showDaxInspector, setShowDaxInspector] = useState(false);

  // Typing is debounced; clearing the box applies immediately
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);
  const queryFilters = { ...filters, search: filters.search.trim() ? debouncedSearch : '' };
  const { kpis, groups, classes } = useDashboardData(queryFilters);

  const queries = [kpis, groups, classes];
  const isFetching = queries.some((q) => q.isFetching);
  const failed = queries.filter((q) => q.isError);

  const handleRefresh = () => void queryClient.invalidateQueries({ queryKey: DAX_QUERY_KEY });
  const handleRetry = () => failed.forEach((q) => void q.refetch());

  // The briefing awaits this: apply filters atomically, then resolve with their data
  const focusAndLoad = useCallback(
    (target: FocusTarget) => loadDashboard(queryClient, useFilterStore.getState().focus(target)),
    [queryClient]
  );

  const kpiValue = (format: (k: KpiData) => string) => (kpis.data ? format(kpis.data) : kpis.isError ? '—' : '…');
  const pctAssessed = kpis.data?.pctAssessed ?? 0;
  const scopeSuffix = filters.className ? 'in selected class' : filters.group ? 'in group' : 'in register';

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
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Direct Semantic Model Visuals (React)</h1>
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
              <span>
                Model: <strong className="font-medium text-slate-700">{MODEL_INFO.name}</strong>
              </span>
              <span>•</span>
              <span className="font-mono text-[11px]">{MODEL_INFO.datasetIdShort}</span>
              <span>•</span>
              <span className="text-teal-600 font-medium">Auth: Service Principal (Entra ID)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Round-Trip Latency:</span>
            <span className="font-mono font-bold text-slate-900">{lastLatency !== null ? `${lastLatency} ms` : '—'}</span>
          </div>

          <button
            type="button"
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
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <FilterBar />

      <div className="p-6 space-y-6 flex-1">
        {failed.length > 0 && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
              <div>
                <div className="font-semibold">The semantic model could not answer every query.</div>
                <div className="text-xs mt-0.5">{errorMessage(failed[0]?.error)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Cards (clickable for cross-filtering) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Assets"
            icon={Database}
            accent="blue"
            value={kpiValue((k) => k.totalAssets.toLocaleString())}
            aside={<span className="text-xs font-medium text-slate-500">{scopeSuffix}</span>}
            footer={
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                DAX: <code className="text-slate-600 font-mono">[Asset Count (All States)]</code>
              </p>
            }
            active={filters.kpiFocus === 'all'}
            stale={kpis.isPlaceholderData}
            onClick={() => actions.setKpiFocus('all')}
            title="Click to reset KPI focus to All Assets"
          />

          <KpiCard
            label="Condition Assessed"
            icon={CheckCircle2}
            accent="emerald"
            value={kpiValue((k) => k.totalAssessed.toLocaleString())}
            aside={
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {(pctAssessed * 100).toFixed(1)}%
              </span>
            }
            footer={
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, pctAssessed * 100))}%` }}
                />
              </div>
            }
            active={filters.kpiFocus === 'assessed'}
            stale={kpis.isPlaceholderData}
            onClick={() => actions.toggleKpiFocus('assessed')}
            title="Click to cross-filter classes with condition assessments"
          />

          <KpiCard
            label="Due For Renewal"
            icon={AlertTriangle}
            accent="amber"
            value={kpiValue((k) => k.dueForRenewal.toLocaleString())}
            aside={
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Urgent Action
              </span>
            }
            footer={
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                DAX: <code className="text-slate-600 font-mono">[Assets Due For Renewal]</code>
              </p>
            }
            active={filters.kpiFocus === 'renewal'}
            stale={kpis.isPlaceholderData}
            onClick={() => actions.toggleKpiFocus('renewal')}
            title="Click to cross-filter classes requiring urgent renewal"
          />

          <KpiCard
            label="Avg Base Life"
            icon={Calendar}
            accent="purple"
            value={kpiValue((k) => `${k.avgBaseLife}`)}
            aside={<span className="text-xs font-medium text-slate-500">Years</span>}
            footer={
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                DAX: <code className="text-slate-600 font-mono">[Avg Base Life (Years)]</code>
              </p>
            }
            stale={kpis.isPlaceholderData}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GroupDistribution
            groups={groups.data}
            selectedGroup={filters.group}
            onToggleGroup={actions.toggleGroup}
            isLoading={groups.isPending}
            isStale={groups.isPlaceholderData}
            error={groups.error}
          />
          <ClassTable
            classes={classes.data}
            selectedClass={filters.className}
            onToggleClass={actions.toggleClass}
            search={filters.search}
            onSearchChange={actions.setSearch}
            scopeLabel={filters.group || 'Global Scope'}
            kpiFocus={filters.kpiFocus}
            isLoading={classes.isPending}
            isStale={classes.isPlaceholderData}
            error={classes.error}
          />
        </div>

        {showDaxInspector && <DaxInspector />}
      </div>

      {/* Floating Voice Briefing Orb; unmounted (and silenced) when the view is hidden */}
      {active && <VoiceBriefingOrb onFocus={focusAndLoad} onResetAll={actions.resetAll} />}
    </div>
  );
};

export default SemanticModelVisuals;
