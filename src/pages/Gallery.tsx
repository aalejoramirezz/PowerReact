import React, { useState } from 'react';
import {
  UniverusBulletBars,
  UniverusDataTable,
  UniverusDivergingBars,
  UniverusDonut,
  UniverusIbcsVariance,
  UniverusKpiCard,
  UniverusKpiHero,
  UniverusRankingBars,
  UniverusSpotlightBars,
  UniverusTrendChart,
  type DataPointClickDetail,
  type Scenario,
  type TableColumn,
} from '../components/univerus';
import {
  ASSET_CLASSES,
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  MONTHS,
  NET_FLOW_BY_SITE,
  RENEWALS_AC_VS_PY,
  REQUESTS_BY_CHANNEL,
  SERVICE_REQUESTS,
  WORK_ORDERS_BY_DEPARTMENT,
} from '../components/univerus/__fixtures__/samples';
import { ReportTemplate } from '../components/template/ReportTemplate';
import { Legend, StatusChip, Tab, Tabs } from '../components/ui/primitives';
import { THEMES, useThemeStore } from '../store/theme';

const SCENARIOS: Scenario[] = ['PY', 'PL', 'FC', 'BU'];

const CLASS_COLUMNS: TableColumn[] = [
  { key: 'className', label: 'Asset Class' },
  { key: 'count', label: 'Inventory', kind: 'number' },
  { key: 'assessed', label: 'Condition Assessed', kind: 'meter', ratioKey: 'pctAssessed' },
  { key: 'due', label: 'Renewals', kind: 'status', suffix: 'due', tone: 'warn', emptyLabel: 'None due' },
];

/**
 * Living catalogue of the Univerus web components with sample data, in whichever theme is active.
 * Visual QA for every change (both themes) and the reference the skills point to. Every visual
 * carries the standard toolbar: Export (CSV / Excel), Table view, Focus view and the ⓘ curtain.
 */
export const Gallery: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const [selected, setSelected] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>('PL');
  const toggle = (e: CustomEvent<DataPointClickDetail>) => {
    const value = e.detail.value === null ? null : String(e.detail.value);
    setSelected((cur) => (cur === value ? null : value));
  };
  const opposite = theme === 'neoglass' ? 'nocturne' : 'neoglass';

  return (
    <ReportTemplate
      eyebrow="Design system · Univerus components"
      title="Visual Gallery"
      meta={
        <span className="flex items-center gap-2 text-[11px] font-semibold text-u-text-soft">
          <span className="u-status-dot" aria-hidden="true" />
          {THEMES[theme].label} ({THEMES[theme].mode}) · sample data
        </span>
      }
    >
      <div className="flex flex-col gap-(--u-gap)" data-testid="gallery">
        <section aria-label="KPI cards" className="grid grid-cols-2 gap-(--u-gap) @4xl:grid-cols-4">
          <UniverusKpiCard
            index={0}
            heading="Service Availability"
            icon="activity"
            displayValue="99.2%"
            delta={{ text: '↑ 1.8%', favourable: true }}
            info="Share of scheduled service hours in which every critical asset was operational."
            calc="Available hours ÷ Scheduled hours"
          />
          <UniverusKpiCard
            index={1}
            heading="Completed Work"
            icon="check-circle"
            value={1284}
            comparisonValue={1184}
            info="Work orders closed in the period, any priority."
            calc="Count of Work Order rows where Status = Closed"
          />
          <UniverusKpiCard
            index={2}
            heading="Avg. Resolution"
            icon="clock"
            displayValue="2.4h"
            delta={{ text: '↓ 12 min', favourable: true }}
            info="Mean time from request to resolution; lower is better."
            calc="Average of Resolution Hours"
          />
          <UniverusKpiCard
            index={3}
            heading="Open Backlog"
            icon="wrench"
            value={312}
            comparisonValue={294}
            goodWhen="lower"
            badge={{ text: '18 urgent', tone: 'warn' }}
            info="Work orders still open at the end of the period."
            calc="Open Work Orders"
          />
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <UniverusKpiHero
            index={4}
            className="@5xl:col-span-7"
            heading="SLA compliance"
            displayValue="94.2"
            unit="%"
            delta={{ text: '↗ 3.1 pts vs August', favourable: true }}
            metrics={[
              { label: 'Avg. response', value: '2.4 h' },
              { label: 'Avg. resolution', value: '18.6 h' },
              { label: 'First-time fix', value: 0.87, format: { style: 'percent', decimals: 0 } },
              { label: 'Backlog', value: 312 },
            ]}
            meter={{ label: 'Crew utilization', value: 0.81 }}
            info="Requests resolved within their SLA window, as a share of all requests closed."
            calc="Requests within SLA ÷ Requests closed"
          />
          <UniverusDonut
            index={5}
            className="@5xl:col-span-5"
            heading="Requests by channel"
            subheading="Composition · September 2026"
            info="How the month's requests split across intake channels (a real total, four parts)."
            calc="Requests by Channel"
            data={REQUESTS_BY_CHANNEL}
            centerLabel="requests"
            interactive
            selectedValue={selected}
            onDataPointClick={toggle}
          />
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <UniverusTrendChart
            index={6}
            className="@5xl:col-span-8"
            heading="Service requests"
            subheading="Received vs resolved · last 12 months"
            label="Service requests, last 12 months"
            info="Monthly intake against resolutions. The comparison stays quiet so the main series leads."
            calc="Requests Received · Requests Resolved by Month"
            categories={MONTHS}
            series={SERVICE_REQUESTS}
            interactive
            selectedValue={selected}
            onDataPointClick={toggle}
          >
            <div slot="aside">
              <Legend
                items={[
                  { label: 'Received', color: 'var(--u-primary)' },
                  { label: 'Resolved', color: 'var(--u-secondary)', variant: 'dashed' },
                ]}
              />
            </div>
          </UniverusTrendChart>
          <UniverusRankingBars
            index={7}
            className="@5xl:col-span-4"
            heading="Work orders by department"
            subheading="Ranking · compact"
            data={WORK_ORDERS_BY_DEPARTMENT}
            topN={7}
          />
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <UniverusSpotlightBars
            index={8}
            className="@5xl:col-span-5"
            heading="Spotlight ranking"
            subheading="Label above a slim bar · share of total · click to select"
            info="Which department leads. The share is computed over every department, before the top N."
            calc="Open Work Orders by Department"
            data={WORK_ORDERS_BY_DEPARTMENT}
            topN={6}
            rank
            interactive
            selectedValue={selected}
            selectedBadge="Selected"
            onDataPointClick={toggle}
          />
          <UniverusBulletBars
            index={9}
            className="@5xl:col-span-7"
            heading="Regional efficiency"
            subheading="Score vs target · tick = target"
            label="Regional efficiency vs target"
            info="Actual efficiency against each region's target; the chip colour follows whether the gap is good."
            calc="(Score − Target) ÷ Target"
            data={EFFICIENCY_VS_TARGET}
            goodWhen="above"
          >
            <span slot="aside">
              <StatusChip tone="accent">good when above</StatusChip>
            </span>
          </UniverusBulletBars>
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <UniverusDivergingBars
            index={10}
            className="@5xl:col-span-5"
            heading="Net flow by site"
            subheading="Arrivals − departures · both ends visible"
            data={NET_FLOW_BY_SITE}
            negativeLabel="Net outflow"
            positiveLabel="Net inflow"
          />
          <UniverusIbcsVariance
            index={11}
            className="@5xl:col-span-7"
            heading="Renewals by asset class"
            subheading="IBCS · structure · AC vs PY"
            label="Renewals AC vs PY"
            info="This year's renewals against the prior year. Δ beyond ±200 % is drawn at the cap as a triangle with its real value."
            calc="ΔPY = AC − PY · ΔPY% = AC ÷ |PY| − 1"
            data={RENEWALS_AC_VS_PY}
            orientation="horizontal"
            scenario="PY"
            goodWhen="higher"
            interactive
            selectedValue={selected}
            onDataPointClick={toggle}
          />
        </section>

        <UniverusIbcsVariance
          index={12}
          heading="Maintenance cost by month"
          subheading="IBCS · time · lower is better"
          label="Maintenance cost by month"
          info="Monthly cost against the reference scenario. Colour follows business meaning: spending above plan is unfavourable even though the variance is positive."
          calc="ΔPL = AC − PL · ΔPL% = AC ÷ |PL| − 1"
          data={COST_AC_VS_PLAN}
          orientation="vertical"
          scenario={scenario}
          goodWhen="lower"
          chartHeight={440}
          format={{ style: 'currency' }}
        >
          <div slot="aside">
            <Tabs label="Comparison scenario">
              {SCENARIOS.map((s) => (
                <Tab key={s} active={scenario === s} onClick={() => setScenario(s)}>
                  {s}
                </Tab>
              ))}
            </Tabs>
          </div>
        </UniverusIbcsVariance>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <UniverusDataTable
            index={13}
            className="@5xl:col-span-8"
            heading="Asset classes"
            subheading="Sortable · paginated · a two-line list on narrow cards"
            label="Asset classes sample"
            info="Which exact rows: identifiers first, status last. Click a header to sort, a row to select it."
            calc="Inventory · Assessed (share) · Due for renewal"
            columns={CLASS_COLUMNS}
            rows={ASSET_CLASSES}
            rowKey="className"
            interactive
            selectedValue={selected}
            onDataPointClick={toggle}
          />
          <UniverusKpiCard
            index={14}
            className="@5xl:col-span-4"
            theme={opposite}
            heading="Pinned template"
            icon="layers"
            displayValue={THEMES[opposite].label}
            caption="theme prop"
            info="The theme prop pins one element to a template, whatever the app theme."
            calc={`theme="${opposite}"`}
          />
        </section>
      </div>
    </ReportTemplate>
  );
};

export default Gallery;
