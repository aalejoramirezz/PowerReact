import React, { useState } from 'react';
import {
  UdpPbiBoxplot,
  UdpPbiBulletBars,
  UdpPbiCalendarHeatmap,
  UdpPbiColumnChart,
  UdpPbiDataTable,
  UdpPbiDivergingBars,
  UdpPbiDonut,
  UdpPbiDotPlot,
  UdpPbiIbcsVariance,
  UdpPbiKpiCard,
  UdpPbiKpiHero,
  UdpPbiMatrix,
  UdpPbiRankingBars,
  UdpPbiScatter,
  UdpPbiSpotlightBars,
  UdpPbiStackedBars,
  UdpPbiTimeline,
  UdpPbiTrendChart,
  UdpPbiTreemap,
  UdpPbiWaterfall,
  type DataPointClickDetail,
  type Scenario,
  type TableColumn,
} from '../components/powerbi-visuals';
import {
  AGEING_BINS,
  BACKLOG_BRIDGE,
  BACKLOG_BY_CREW,
  CLASS_RISK_POINTS,
  ASSET_CLASSES,
  ASSET_GROUPS,
  CONDITION_BY_GROUP,
  CONDITION_DISTRIBUTION,
  CONDITION_GRADES,
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  FINANCIAL_BRIDGE,
  MONTH_CATEGORIES,
  MONTHS,
  NET_FLOW_BY_SITE,
  OPEN_REQUESTS_AGEING,
  PORTFOLIO_MEASURES,
  PORTFOLIO_TOTAL,
  PORTFOLIO_TREE,
  PORTFOLIO_TREEMAP,
  PRIORITIES,
  RENEWAL_NEED_VS_BUDGET,
  RENEWAL_YEARS,
  RENEWALS_AC_VS_PY,
  REQUESTS_BY_CHANNEL,
  REQUESTS_BY_DAY,
  RISK_MATRIX,
  RISK_MEASURES,
  RISK_TOTAL,
  SERVICE_REQUESTS,
  STATUS_BY_PRIORITY,
  WARRANTIES,
  WARRANTY_TODAY,
  WORK_ORDERS_BY_DEPARTMENT,
  WORK_REQUESTS_BY_STATUS,
} from '../components/powerbi-visuals/__fixtures__/samples';
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

/** The FT Visual Vocabulary families the gallery is organised by, each with the question it answers. */
const FAMILIES = [
  { id: 'magnitude', title: 'Magnitude', question: 'How much? How do sizes compare?' },
  { id: 'ranking', title: 'Ranking', question: 'Which leads, in order?' },
  { id: 'change', title: 'Change over time', question: 'How did it evolve?' },
  { id: 'deviation', title: 'Deviation', question: 'How far from a reference, and which way?' },
  { id: 'part-to-whole', title: 'Part-to-whole', question: 'How is a real total split?' },
  { id: 'flow', title: 'Flow', question: 'How does one level become another?' },
  { id: 'distribution', title: 'Distribution', question: 'How are the values spread?' },
  { id: 'correlation', title: 'Correlation', question: 'How do two things relate?' },
  { id: 'exact', title: 'Exact values', question: 'Which rows, owners and statuses?' },
] as const;

type FamilyId = (typeof FAMILIES)[number]['id'];

const Family: React.FC<{ id: FamilyId; children: React.ReactNode }> = ({ id, children }) => {
  const family = FAMILIES.find((f) => f.id === id);
  return (
    <section aria-labelledby={`ft-${id}`} className="flex scroll-mt-4 flex-col gap-(--u-gap)">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
        <h2 id={`ft-${id}`} className="u-eyebrow">
          {family?.title}
        </h2>
        <p className="text-[12px] text-u-text-soft">{family?.question}</p>
      </header>
      {children}
    </section>
  );
};

/**
 * Living catalogue of the Univerus web components with sample data, in whichever theme is active,
 * grouped by FT Visual Vocabulary family.
 * Visual QA for every change (both themes) and the reference the skills point to. Every visual
 * carries the standard toolbar: Export (CSV / Excel), Table view, Focus view and the ⓘ curtain.
 */
export const Gallery: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const [selected, setSelected] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>('PL');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
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
        <nav aria-label="Chart families" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {FAMILIES.map((f) => (
            <a
              key={f.id}
              href={`#ft-${f.id}`}
              className="text-[11.5px] font-semibold text-u-text-soft underline-offset-4 hover:text-u-title hover:underline"
            >
              {f.title}
            </a>
          ))}
        </nav>

        <Family id="magnitude">
          <section aria-label="KPI cards" className="grid grid-cols-2 gap-(--u-gap) @4xl:grid-cols-4">
            <UdpPbiKpiCard
              index={0}
              heading="Service Availability"
              icon="activity"
              displayValue="99.2%"
              delta={{ text: '↑ 1.8%', favourable: true }}
              info="Share of scheduled service hours in which every critical asset was operational."
              calc="Available hours ÷ Scheduled hours"
            />
            <UdpPbiKpiCard
              index={1}
              heading="Completed Work"
              icon="check-circle"
              value={1284}
              comparisonValue={1184}
              info="Work orders closed in the period, any priority."
              calc="Count of Work Order rows where Status = Closed"
            />
            <UdpPbiKpiCard
              index={2}
              heading="Avg. Resolution"
              icon="clock"
              displayValue="2.4h"
              delta={{ text: '↓ 12 min', favourable: true }}
              info="Mean time from request to resolution; lower is better."
              calc="Average of Resolution Hours"
            />
            <UdpPbiKpiCard
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
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiKpiHero
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
            <UdpPbiBulletBars
              index={5}
              className="@5xl:col-span-5"
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
            </UdpPbiBulletBars>
          </div>
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiColumnChart
              index={6}
              className="@5xl:col-span-12"
              heading="Renewal need vs budget"
              subheading="Grouped columns · by year · reference line"
              label="Renewal need and budget by year"
              info="Funding gap at a glance: each year's renewal need beside its budget. The dashed line is the average need."
              calc="[Renewal Need] · [Renewal Budget] by 'Date'[Year]"
              categories={RENEWAL_YEARS}
              series={RENEWAL_NEED_VS_BUDGET}
              layout="grouped"
              format={{ style: 'compact' }}
              referenceLines={[{ value: 4.675e6, label: 'Avg need' }]}
              categoryLabel="Year"
              crossFilterField="'Date'[Year]"
              selectedValue={selectedYear}
              onDataPointClick={(e) => setSelectedYear((cur) => (cur === e.detail.value ? null : (e.detail.value as number | null)))}
            />
          </div>
        </Family>

        <Family id="ranking">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiSpotlightBars
              index={7}
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
            <UdpPbiRankingBars
              index={8}
              className="@5xl:col-span-7"
              heading="Work orders by department"
              subheading="Ranking · compact"
              data={WORK_ORDERS_BY_DEPARTMENT}
              topN={7}
            />
          </div>
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiRankingBars
              className="@5xl:col-span-5"
              index={23}
              heading="Work orders, lollipop"
              subheading="Ranking · a hairline and a dot"
              data={WORK_ORDERS_BY_DEPARTMENT}
              topN={7}
              mark="lollipop"
            />
            <UdpPbiDotPlot
              className="@5xl:col-span-7"
              index={24}
              heading="Backlog by crew"
              subheading="Dumbbell · 30 days ago → now · lower is better"
              info="Open work requests per crew a month ago and now; the line is teal where the backlog shrank and red where it grew."
              calc="[Open WRs 30 Days Ago] → [Open WRs] by Crew"
              items={BACKLOG_BY_CREW}
              fromLabel="30 days ago"
              toLabel="Now"
              goodWhen="lower"
              sort="to"
              categoryLabel="Crew"
              interactive
              selectedValue={selected}
              onDataPointClick={toggle}
              testIdPrefix="crew-dots"
            />
          </div>
        </Family>

        <Family id="change">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiTrendChart
              index={9}
              className="@5xl:col-span-7"
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
            </UdpPbiTrendChart>
            <UdpPbiColumnChart
              index={10}
              className="@5xl:col-span-5"
              heading="Work requests by status"
              subheading="Stacked columns · by month · tooltip measures"
              info="Monthly work requests split by their current status; the tooltip adds the share resolved within SLA."
              calc="[Work Requests] by Month and Status"
              categories={MONTH_CATEGORIES}
              series={WORK_REQUESTS_BY_STATUS}
              layout="stacked"
              categoryLabel="Month"
              interactive
              seriesField="'work_request'[Status]"
              selectedValue={selected}
              onDataPointClick={toggle}
            />
          </div>
          <UdpPbiIbcsVariance
            index={11}
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
          </UdpPbiIbcsVariance>
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiTrendChart
              className="@5xl:col-span-7"
              index={25}
              heading="Funding gap"
              subheading="Renewal need vs budget · shortfall shaded"
              label="Renewal need vs budget by year"
              info="Where renewal need runs above the budget (red) or below it (teal); the dashed line is the average need."
              calc="[Renewal Need] vs [Renewal Budget] by Year"
              categories={RENEWAL_YEARS.map((y) => y.label)}
              series={[
                { id: 'need', label: 'Renewal need', role: 'primary', values: RENEWAL_NEED_VS_BUDGET[0]?.values ?? [] },
                { id: 'budget', label: 'Budget', role: 'comparison', values: RENEWAL_NEED_VS_BUDGET[1]?.values ?? [] },
              ]}
              gap
              goodWhen="lower"
              referenceLines={[{ value: 4.675e6, label: 'Avg need' }]}
              format={{ style: 'compact' }}
            />
            <UdpPbiDotPlot
              className="@5xl:col-span-5"
              index={26}
              heading="Backlog by crew, slope"
              subheading="Slope · 30 days ago → now"
              items={BACKLOG_BY_CREW}
              variant="slope"
              fromLabel="30 days ago"
              toLabel="Now"
              goodWhen="lower"
              categoryLabel="Crew"
            />
          </div>
          <UdpPbiCalendarHeatmap
            index={27}
            heading="Work requests raised per day"
            subheading="Calendar heatmap · Feb–Sep 2026 · darker = more"
            info="Daily intake: weekday rhythm, quiet weekends and the mid-April spike read at a glance."
            calc="[WRs Raised by Raised Date] by 'Date'[Date]"
            days={REQUESTS_BY_DAY}
            valueLabel="Work requests"
            crossFilterField="'Date'[Date]"
            testIdPrefix="intake"
          />
          <UdpPbiTimeline
            index={28}
            heading="Equipment warranties"
            subheading="Timeline · by asset class · today marked"
            info="Which warranties run, which end within 90 days (amber) and which have lapsed (red)."
            calc="'warranty'[Start_Date] → 'warranty'[End_Date] by Asset Class"
            tasks={WARRANTIES}
            today={WARRANTY_TODAY}
            toneLabels={{ ok: 'Active', warn: 'Ends within 90 days', bad: 'Expired' }}
            categoryLabel="Warranty"
            laneLabel="Asset class"
            testIdPrefix="warranty"
          />
        </Family>

        <Family id="deviation">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiDivergingBars
              index={12}
              className="@5xl:col-span-5"
              heading="Net flow by site"
              subheading="Arrivals − departures · both ends visible"
              data={NET_FLOW_BY_SITE}
              negativeLabel="Net outflow"
              positiveLabel="Net inflow"
            />
            <UdpPbiIbcsVariance
              index={13}
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
          </div>
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiStackedBars
              index={14}
              className="@5xl:col-span-12"
              heading="Condition profile by group"
              subheading="Diverging stacked bars · worst ↔ best around Fair"
              label="Condition grades by asset group"
              info="Share of each group's assets by condition grade: poor grades extend left of the axis, good grades right, Fair straddles it."
              calc="[Asset Count] by Group and Condition Grade ÷ group total"
              categories={ASSET_GROUPS}
              series={CONDITION_BY_GROUP}
              layout="diverging"
              palette="diverging"
              negativeSeries={['Very Poor', 'Poor']}
              neutralSeries={['Fair']}
              categoryLabel="Group"
              interactive
              seriesField="'condition'[Grade]"
            />
          </div>
        </Family>

        <Family id="part-to-whole">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiDonut
              index={15}
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
            <UdpPbiStackedBars
              index={16}
              className="@5xl:col-span-7"
              heading="Status by priority"
              subheading="100 % stacked bars · totals at the end"
              info="How each priority's work requests split by status; the number is the priority's total."
              calc="[Work Requests] by Priority and Status ÷ priority total"
              categories={PRIORITIES}
              series={STATUS_BY_PRIORITY}
              layout="percent"
              categoryLabel="Priority"
            />
          </div>
          <UdpPbiTreemap
            index={29}
            heading="Inventory by group and class"
            subheading="Treemap · area = assets · colour = share assessed"
            info="How the register splits by group and class; darker tiles have more of their assets condition-assessed."
            calc="[Asset Count] by Group › Class · colour [% Assessed For Condition]"
            nodes={PORTFOLIO_TREEMAP}
            colorLabel="Assessed"
            colorFormat={{ style: 'percent', decimals: 0 }}
            levelLabels={['Group', 'Class']}
            levelFields={["'asset_class_group'[Asset_Class_Group]", "'asset_class'[Asset_Class]"]}
            testIdPrefix="inventory"
          />
        </Family>

        <Family id="flow">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiWaterfall
              className="@5xl:col-span-6"
              index={30}
              heading="Backlog bridge"
              subheading="Waterfall · last 30 days · lower is better"
              info="How the open work-request backlog moved: raised adds to it, merged and closed take it down."
              calc="[Open WRs 30 Days Ago] + [Raised] − [Merged] − [Closed] = [Open WRs]"
              steps={BACKLOG_BRIDGE}
              goodWhen="lower"
              categoryLabel="Movement"
              testIdPrefix="backlog"
            />
            <UdpPbiWaterfall
              className="@5xl:col-span-6"
              index={31}
              heading="Financial position"
              subheading="Waterfall · horizontal · the year's movements"
              info="From the opening to the closing book value: additions and revaluation raise it, disposals and depreciation lower it."
              calc="[Opening Book Value] … [Written Down Value]"
              steps={FINANCIAL_BRIDGE}
              orientation="horizontal"
              baseline="auto"
              format={{ style: 'compact' }}
              categoryLabel="Movement"
            />
          </div>
        </Family>

        <Family id="distribution">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiColumnChart
              index={17}
              className="@5xl:col-span-6"
              heading="Open requests by age"
              subheading="Histogram · bins from DAX"
              info="How long open work requests have been waiting: one bar per age band, touching because the bands are continuous."
              calc="[Open Work Requests] by Age Band"
              categories={AGEING_BINS}
              series={OPEN_REQUESTS_AGEING}
              variant="histogram"
              categoryLabel="Age band"
            />
            <UdpPbiBoxplot
              index={32}
              className="@5xl:col-span-6"
              heading="Condition index by group"
              subheading="Box plot · median, quartiles, Tukey whiskers"
              info="How condition spreads inside each group: the box holds the middle half, the dots are outliers."
              calc="PERCENTILEX.INC of 'asset_register'[Condition_Index] by Group"
              items={CONDITION_DISTRIBUTION}
              format={{ style: 'decimal', decimals: 1 }}
              categoryLabel="Group"
              testIdPrefix="condition-box"
            />
          </div>
        </Family>

        <Family id="correlation">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiMatrix
              index={20}
              className="@5xl:col-span-7"
              heading="Criticality × condition"
              subheading="Risk matrix · heatmap · totals from the engine"
              info="Where the portfolio's risk concentrates: assets by criticality and condition grade. Darker cells hold more assets; totals come from the model."
              calc="[Asset Count] by Criticality × Condition Grade (ROLLUPADDISSUBTOTAL)"
              nodes={RISK_MATRIX}
              columns={CONDITION_GRADES}
              measures={RISK_MEASURES}
              grandTotal={RISK_TOTAL}
              rowLevels={['Criticality']}
              columnHeader="Condition grade"
              crossFilterField="'asset'[Criticality]"
              columnField="'asset'[Condition Grade]"
              testIdPrefix="risk"
            />
            <UdpPbiScatter
              index={22}
              className="@5xl:col-span-5"
              heading="Condition vs criticality"
              subheading="Bubble · size = inventory · quadrants at the mid grade"
              info="Each asset class by average condition (higher is worse) and criticality; the bubble's area is its inventory. Top right needs action first."
              calc="[Avg Condition Score] × [Avg Criticality] by Class · size [Asset Count]"
              points={CLASS_RISK_POINTS}
              xLabel="Condition"
              yLabel="Criticality"
              sizeLabel="Assets"
              xFormat={{ style: 'decimal' }}
              format={{ style: 'decimal' }}
              xReference={{ value: 3 }}
              yReference={{ value: 3 }}
              quadrantLabels={['Watch', 'Act now', 'Low priority', 'Maintain']}
              categoryLabel="Class"
              crossFilterField="'asset_class'[Asset_Class]"
              selectedValue={selected}
              onDataPointClick={toggle}
              testIdPrefix="risk-scatter"
            />
          </div>
        </Family>

        <Family id="exact">
          <div className="grid grid-cols-1 gap-(--u-gap) @5xl:grid-cols-12">
            <UdpPbiDataTable
              index={18}
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
            <UdpPbiKpiCard
              index={19}
              className="@5xl:col-span-4"
              theme={opposite}
              heading="Pinned template"
              icon="layers"
              displayValue={THEMES[opposite].label}
              caption="theme prop"
              info="The theme prop pins one element to a template, whatever the app theme."
              calc={`theme="${opposite}"`}
            />
          </div>
          <UdpPbiMatrix
            index={21}
            heading="Portfolio by group and class"
            subheading="Matrix · expandable rows · assessed share against the 80 % target"
            label="Portfolio matrix by group and class"
            info="Inventory, condition-assessed share and renewals due, by asset group; expand a group for its classes. The share is coloured around the 80 % target."
            calc="[Asset Count] · [% Assessed For Condition] · [Assets Due For Renewal] by Group › Class"
            nodes={PORTFOLIO_TREE}
            measures={PORTFOLIO_MEASURES}
            grandTotal={PORTFOLIO_TOTAL}
            rowLevels={['Group', 'Class']}
            expandLevel={1}
            rowFields={["'asset_class_group'[Asset_Class_Group]", "'asset_class'[Asset_Class]"]}
            testIdPrefix="portfolio"
          />
        </Family>
      </div>
    </ReportTemplate>
  );
};

export default Gallery;
