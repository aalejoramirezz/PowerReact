import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartCard } from '../ui/Card';
import { KpiCard } from '../ui/KpiCard';
import { KpiHero } from '../ui/KpiHero';
import { BulletBars, DivergingBars, Donut, IbcsVariance, RankingBars, SpotlightBars, TrendChart } from '.';
import {
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  MONTHS,
  NET_FLOW_BY_SITE,
  RENEWALS_AC_VS_PY,
  REQUESTS_BY_CHANNEL,
  SERVICE_REQUESTS,
  WORK_ORDERS_BY_DEPARTMENT,
} from './__fixtures__/samples';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('charts render server-side with sample data', () => {
  it('SpotlightBars shows shares over every category and the rank', () => {
    const out = html(<SpotlightBars data={WORK_ORDERS_BY_DEPARTMENT} label="x" rank topN={3} />);
    expect(out).toContain('#1');
    expect(out).toContain('26.2%');
    expect(out.match(/<li/g)).toHaveLength(3);
  });

  it('RankingBars notes hidden categories', () => {
    expect(html(<RankingBars data={WORK_ORDERS_BY_DEPARTMENT} label="x" topN={5} />)).toContain('Top 5 of 8');
  });

  it('BulletBars colours the variance chip by meaning', () => {
    const out = html(<BulletBars data={EFFICIENCY_VS_TARGET} label="x" />);
    expect(out).toContain('data-tone="ok"');
    expect(out).toContain('data-tone="bad"');
  });

  it('DivergingBars labels both directions', () => {
    const out = html(<DivergingBars data={NET_FLOW_BY_SITE} label="x" negativeLabel="Out" positiveLabel="In" />);
    expect(out).toContain('← Out');
    expect(out).toContain('In →');
    expect(out).toContain('−41');
  });

  it('Donut shows the total in the hole', () => {
    expect(html(<Donut data={REQUESTS_BY_CHANNEL} label="x" centerLabel="requests" />)).toContain('2,760');
  });

  it('TrendChart labels the series directly', () => {
    const out = html(<TrendChart categories={MONTHS} series={SERVICE_REQUESTS} label="x" />);
    expect(out).toContain('Received');
    expect(out).toContain('2,880');
  });

  it('IbcsVariance titles its panels with scenario and unit', () => {
    const horizontal = html(<IbcsVariance data={RENEWALS_AC_VS_PY} label="x" scenario="PY" />);
    expect(horizontal).toContain('AC vs PY');
    expect(horizontal).toContain('ΔPY%');
    const vertical = html(<IbcsVariance data={COST_AC_VS_PLAN} label="x" orientation="vertical" scenario="PL" goodWhen="lower" />);
    expect(vertical).toContain('AC vs PL · K');
  });

  it.each([
    ['SpotlightBars', () => <SpotlightBars data={[]} label="x" />],
    ['RankingBars', () => <RankingBars data={[]} label="x" />],
    ['BulletBars', () => <BulletBars data={[]} label="x" />],
    ['DivergingBars', () => <DivergingBars data={[]} label="x" />],
    ['Donut', () => <Donut data={[]} label="x" />],
    ['TrendChart', () => <TrendChart categories={[]} series={[]} label="x" />],
  ])('%s renders with no data', (_name, render) => {
    expect(() => html(render())).not.toThrow();
  });

  it('IbcsVariance renders an empty state with the same geometry', () => {
    expect(html(<IbcsVariance data={[]} label="x" />)).toContain('No data for the current selection.');
  });
});

describe('cards carry the curtain', () => {
  it('KpiCard describes itself with "What it means" and the calculation', () => {
    const out = html(<KpiCard label="Total Assets" value="10,000" info="Assets in scope." calc="[Asset Count]" onClick={() => {}} />);
    expect(out).toContain('What it means');
    expect(out).toContain('aria-describedby');
    expect(out).toContain('data-testid="kpi-total-assets"');
    // A plain action (no `active`) has no pressed state; touch screens get an ⓘ for the curtain
    expect(out).not.toContain('aria-pressed');
    expect(out).toContain('aria-label="What Total Assets means"');
  });

  it('KpiCard exposes its toggle state only when it is a toggle', () => {
    const toggle = html(<KpiCard label="Due" value="1" active={false} onClick={() => {}} />);
    expect(toggle).toContain('aria-pressed="false"');
    expect(html(<KpiCard label="Due" value="1" active onClick={() => {}} />)).toContain('aria-pressed="true"');
  });

  it('ChartCard exposes the curtain through an ⓘ button, closed by default', () => {
    const out = html(
      <ChartCard title="T" info="Means X." calc="Y">
        <p>chart</p>
      </ChartCard>
    );
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-open="false"');
  });

  it('KpiHero renders the 60-tick meter', () => {
    const out = html(<KpiHero label="SLA" value="94.2" meter={{ label: 'Crew', value: 0.81 }} />);
    expect(out.match(/<i /g)).toHaveLength(60);
    expect(out).toContain('aria-valuenow="81"');
  });
});
