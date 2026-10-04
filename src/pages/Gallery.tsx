import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, Wrench } from 'lucide-react';
import {
  BulletBars,
  DivergingBars,
  Donut,
  IbcsVariance,
  RankingBars,
  SpotlightBars,
  TrendChart,
  type Scenario,
} from '../components/charts';
import {
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  MONTHS,
  NET_FLOW_BY_SITE,
  RENEWALS_AC_VS_PY,
  REQUESTS_BY_CHANNEL,
  SERVICE_REQUESTS,
  WORK_ORDERS_BY_DEPARTMENT,
} from '../components/charts/__fixtures__/samples';
import { ReportTemplate } from '../components/template/ReportTemplate';
import { ChartCard } from '../components/ui/Card';
import { KpiCard, KpiDelta } from '../components/ui/KpiCard';
import { KpiHero } from '../components/ui/KpiHero';
import { Legend, StatusChip, Tab, Tabs } from '../components/ui/primitives';
import { THEMES, useThemeStore } from '../store/theme';

const SCENARIOS: Scenario[] = ['PY', 'PL', 'FC', 'BU'];

/**
 * Living catalogue of the Univerus components with sample data, in whichever theme is active.
 * Visual QA for every change (both themes) and the reference the skills point to.
 */
export const Gallery: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const [selected, setSelected] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>('PL');
  const toggle = (id: string) => setSelected((cur) => (cur === id ? null : id));

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
        <section aria-label="KPI cards" className="grid grid-cols-1 gap-(--u-gap) @md:grid-cols-2 @4xl:grid-cols-4">
          <KpiCard
            index={0}
            label="Service Availability"
            icon={Activity}
            value="99.2%"
            aside={<KpiDelta value="↑ 1.8%" favourable />}
            info="Share of scheduled service hours in which every critical asset was operational."
            calc="Available hours ÷ Scheduled hours"
          />
          <KpiCard
            index={1}
            label="Completed Work"
            icon={CheckCircle2}
            value="1,284"
            aside={<KpiDelta value="↑ 8.4%" favourable />}
            info="Work orders closed in the period, any priority."
            calc="Count of Work Order rows where Status = Closed"
          />
          <KpiCard
            index={2}
            label="Avg. Resolution"
            icon={Clock}
            value="2.4h"
            aside={<KpiDelta value="↓ 12 min" favourable />}
            info="Mean time from request to resolution; lower is better."
            calc="Average of Resolution Hours"
          />
          <KpiCard
            index={3}
            label="Open Backlog"
            icon={Wrench}
            value="312"
            aside={<KpiDelta value="↑ 6.1%" favourable={false} />}
            info="Work orders still open at the end of the period."
            calc="Open Work Orders"
          />
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <KpiHero
            index={4}
            className="@5xl:col-span-7"
            label="SLA compliance"
            value="94.2"
            unit="%"
            delta={{ text: '↗ 3.1 pts vs August', favourable: true }}
            metrics={[
              { label: 'Avg. response', value: '2.4 h' },
              { label: 'Avg. resolution', value: '18.6 h' },
              { label: 'First-time fix', value: '87%' },
              { label: 'Backlog', value: '312' },
            ]}
            meter={{ label: 'Crew utilization', value: 0.81 }}
            info="Requests resolved within their SLA window, as a share of all requests closed."
            calc="Requests within SLA ÷ Requests closed"
          />
          <ChartCard
            index={5}
            className="@5xl:col-span-5"
            title="Requests by channel"
            subtitle="Composition · September 2026"
            info="How the month's requests split across intake channels (a real total, four parts)."
            calc="Requests by Channel"
          >
            <Donut data={REQUESTS_BY_CHANNEL} label="Requests by channel" centerLabel="requests" selectedId={selected} onSelect={(d) => toggle(d.id)} />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <ChartCard
            index={6}
            className="@5xl:col-span-8"
            title="Service requests"
            subtitle="Received vs resolved · last 12 months"
            aside={
              <Legend
                items={[
                  { label: 'Received', color: 'var(--u-primary)' },
                  { label: 'Resolved', color: 'var(--u-secondary)', variant: 'dashed' },
                ]}
              />
            }
            info="Monthly intake against resolutions. The comparison stays quiet so the main series leads."
            calc="Requests Received · Requests Resolved by Month"
          >
            <TrendChart categories={MONTHS} series={SERVICE_REQUESTS} label="Service requests, last 12 months" />
          </ChartCard>
          <ChartCard index={7} className="@5xl:col-span-4" title="Work orders by department" subtitle="Ranking · compact">
            <RankingBars data={WORK_ORDERS_BY_DEPARTMENT} label="Work orders by department" topN={7} />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <ChartCard
            index={8}
            className="@5xl:col-span-5"
            title="Spotlight ranking"
            subtitle="Label above a slim bar · share of total · click to select"
            info="Which department leads. The share is computed over every department, before the top N."
            calc="Open Work Orders by Department"
          >
            <SpotlightBars data={WORK_ORDERS_BY_DEPARTMENT} label="Spotlight ranking" topN={6} rank selectedId={selected} onSelect={(d) => toggle(d.id)} selectedBadge="Selected" />
          </ChartCard>
          <ChartCard
            index={9}
            className="@5xl:col-span-7"
            title="Regional efficiency"
            subtitle="Score vs target · tick = target"
            aside={<StatusChip tone="accent">good when above</StatusChip>}
            info="Actual efficiency against each region's target; the chip colour follows whether the gap is good."
            calc="(Score − Target) ÷ Target"
          >
            <BulletBars data={EFFICIENCY_VS_TARGET} label="Regional efficiency vs target" goodWhen="above" />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
          <ChartCard index={10} className="@5xl:col-span-5" title="Net flow by site" subtitle="Arrivals − departures · both ends visible">
            <DivergingBars data={NET_FLOW_BY_SITE} label="Net flow by site" negativeLabel="Net outflow" positiveLabel="Net inflow" />
          </ChartCard>
          <ChartCard
            index={11}
            className="@5xl:col-span-7"
            title="Renewals by asset class"
            subtitle="IBCS · structure · AC vs PY"
            info="This year's renewals against the prior year. Δ beyond ±200 % is drawn at the cap as a triangle with its real value."
            calc="ΔPY = AC − PY · ΔPY% = AC ÷ |PY| − 1"
          >
            <IbcsVariance data={RENEWALS_AC_VS_PY} label="Renewals AC vs PY" orientation="horizontal" scenario="PY" goodWhen="higher" selectedId={selected} onSelect={(d) => toggle(d.id)} />
          </ChartCard>
        </section>

        <ChartCard
          index={12}
          title="Maintenance cost by month"
          subtitle="IBCS · time · lower is better"
          aside={
            <Tabs label="Comparison scenario">
              {SCENARIOS.map((s) => (
                <Tab key={s} active={scenario === s} onClick={() => setScenario(s)}>
                  {s}
                </Tab>
              ))}
            </Tabs>
          }
          info="Monthly cost against the reference scenario. Colour follows business meaning: spending above plan is unfavourable even though the variance is positive."
          calc="ΔPL = AC − PL · ΔPL% = AC ÷ |PL| − 1"
        >
          <IbcsVariance data={COST_AC_VS_PLAN} label="Maintenance cost by month" orientation="vertical" scenario={scenario} goodWhen="lower" height={440} />
        </ChartCard>
      </div>
    </ReportTemplate>
  );
};

export default Gallery;
