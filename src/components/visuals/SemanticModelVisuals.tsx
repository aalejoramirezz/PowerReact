import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, Headphones, RotateCw } from 'lucide-react';
import { errorMessage } from '../../api/http';
import { loadDashboard, useDashboardData } from '../../hooks/useDashboardData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DAX_QUERY_KEY } from '../../hooks/useSemanticQuery';
import { selectFilters, useFilterStore, type FocusTarget } from '../../store/filters';
import { VoiceBriefingOrb } from '../briefing/VoiceBriefingOrb';
import { ReportTemplate } from '../template/ReportTemplate';
import { Sheet } from '../ui/Sheet';
import { UdpPbiKpiCard } from '../powerbi-visuals';
import { ClassTable } from './ClassTable';
import { DaxInspector } from './DaxInspector';
import { FilterBar } from './FilterBar';
import { GroupDistribution } from './GroupDistribution';
import { KPI_DEFINITIONS } from './kpiDefinitions';
import { ReportDetails } from './ReportDetails';

const SEARCH_DEBOUNCE_MS = 300;

interface SemanticModelVisualsProps {
  /** False while the view is kept mounted but hidden behind another route. */
  active?: boolean;
}

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingPlaying, setBriefingPlaying] = useState(false);

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

  // Shared by the four KPI cards: '…' until the first answer, '—' on error, dimmed while refetching
  const kpiState = {
    loading: kpis.isPending,
    error: kpis.error ? errorMessage(kpis.error) : undefined,
    stale: kpis.isPlaceholderData,
    exportable: false,
    focusable: false,
  };
  const pctAssessed = kpis.data?.pctAssessed ?? 0;
  const pctDue = kpis.data && kpis.data.totalAssets > 0 ? kpis.data.dueForRenewal / kpis.data.totalAssets : 0;
  const scopeSuffix = filters.className ? 'in selected class' : filters.group ? 'in group' : 'in register';

  return (
    <ReportTemplate
      eyebrow="Asset Management"
      title="Asset Portfolio Overview"
      meta={
        kpis.dataUpdatedAt > 0 && (
          <span className="hidden text-[11px] text-u-label @2xl/plane:inline">
            Updated{' '}
            <time className="u-num font-medium text-u-text-soft" dateTime={new Date(kpis.dataUpdatedAt).toISOString()}>
              {formatTime(kpis.dataUpdatedAt)}
            </time>
          </span>
        )
      }
      actions={
        <>
          {/* Icon-only on narrow planes: aria-label keeps the visible word as the accessible name */}
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            className="u-btn-ghost"
            title="Start Guided Briefing"
            aria-label="Briefing"
            aria-haspopup="dialog"
            aria-expanded={briefingOpen}
          >
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden @lg/plane:inline">Briefing</span>
          </button>
          <ReportDetails onOpenInspector={() => setInspectorOpen(true)} />
          <button type="button" onClick={handleRefresh} disabled={isFetching} className="u-btn" aria-label="Refresh">
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'u-spin' : ''}`} aria-hidden="true" />
            <span className="hidden @lg/plane:inline">Refresh</span>
          </button>
        </>
      }
      toolbar={<FilterBar />}
      // Room under the table so the briefing mini-player never covers the last rows
      contentClassName={active && briefingPlaying ? 'pb-28' : undefined}
    >
      <div className="flex flex-col gap-(--u-gap)">
        {failed.length > 0 && (
          <div
            role="alert"
            className="u-anim-fade flex items-start justify-between gap-4 rounded-[var(--u-card-radius)] border border-u-bad/30 bg-u-bad-bg p-4 text-[13px] text-u-bad-text"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">The semantic model could not answer every query.</div>
                <div className="mt-0.5 text-[12px]">{errorMessage(failed[0]?.error)}</div>
              </div>
            </div>
            <button type="button" onClick={handleRetry} className="u-btn-ghost shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* 1. KPIs: how much (click to focus the class table); 2×2 on phones and tablets.
            They are filter toggles here, so the ⋯ menu (export, focus view) is off: one tab stop per card. */}
        <div className="grid grid-cols-2 gap-(--u-gap) @4xl:grid-cols-4" data-testid="kpi-grid">
          {/* A plain action: "all" is the resting state, so it never shows a selection ring */}
          <UdpPbiKpiCard
            {...kpiState}
            index={0}
            visualId="kpi-total"
            heading="Total Assets"
            icon="database"
            value={kpis.data?.totalAssets}
            caption={scopeSuffix}
            interactive
            onDataPointClick={() => actions.setKpiFocus('all')}
            title="Click to reset KPI focus to All Assets"
            info={KPI_DEFINITIONS.totalAssets.info}
            calc={KPI_DEFINITIONS.totalAssets.calc}
          />

          <UdpPbiKpiCard
            {...kpiState}
            index={1}
            visualId="kpi-assessed"
            heading="Condition Assessed"
            icon="check-circle"
            value={kpis.data?.totalAssessed}
            meter={{ value: pctAssessed, detail: 'of assets' }}
            active={filters.kpiFocus === 'assessed'}
            onDataPointClick={() => actions.toggleKpiFocus('assessed')}
            title="Click to cross-filter classes with condition assessments"
            info={KPI_DEFINITIONS.assessed.info}
            calc={KPI_DEFINITIONS.assessed.calc}
          />

          <UdpPbiKpiCard
            {...kpiState}
            index={2}
            visualId="kpi-renewal"
            heading="Due For Renewal"
            icon="alert-triangle"
            value={kpis.data?.dueForRenewal}
            badge={
              kpis.data
                ? kpis.data.dueForRenewal > 0
                  ? { text: `${(pctDue * 100).toFixed(1)}%`, detail: 'of assets', tone: 'warn' }
                  : { text: 'None due', tone: 'ok' }
                : undefined
            }
            active={filters.kpiFocus === 'renewal'}
            onDataPointClick={() => actions.toggleKpiFocus('renewal')}
            title="Click to cross-filter classes due for renewal"
            info={KPI_DEFINITIONS.renewal.info}
            calc={KPI_DEFINITIONS.renewal.calc}
          />

          <UdpPbiKpiCard
            {...kpiState}
            index={3}
            visualId="kpi-base-life"
            heading="Avg Base Life"
            icon="calendar"
            displayValue={kpis.data ? `${kpis.data.avgBaseLife}` : undefined}
            caption="Years"
            info={KPI_DEFINITIONS.baseLife.info}
            calc={KPI_DEFINITIONS.baseLife.calc}
          />
        </div>

        {/* 2. Breakdowns: which group leads, which exact classes */}
        <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <GroupDistribution
            index={4}
            className="@5xl:col-span-5"
            groups={groups.data}
            selectedGroup={filters.group}
            onToggleGroup={actions.toggleGroup}
            isLoading={groups.isPending}
            isStale={groups.isPlaceholderData}
            error={groups.error}
          />
          <ClassTable
            index={5}
            className="@5xl:col-span-7"
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
      </div>

      {/* Developer tooling lives off-canvas, opened from "Report details" */}
      <Sheet open={inspectorOpen} onClose={() => setInspectorOpen(false)} title="DAX Inspector">
        <DaxInspector />
      </Sheet>

      {/* Briefing dialog + mini-player; unmounted (and silenced) when the view is hidden */}
      {active && (
        <VoiceBriefingOrb
          onFocus={focusAndLoad}
          onResetAll={actions.resetAll}
          open={briefingOpen}
          onOpenChange={setBriefingOpen}
          onPlayingChange={setBriefingPlaying}
        />
      )}
    </ReportTemplate>
  );
};

export default SemanticModelVisuals;
