import { describe, expect, it } from 'vitest';
import type { ClassRow, DashboardSnapshot, GroupRow, KpiData } from '../../lib/dax/types';
import { FULL_BRIEFING, parseVoiceCommand, SECTION_BRIEFINGS, type BriefingStep } from './briefingScript';

const kpis = (overrides: Partial<KpiData> = {}): KpiData => ({
  totalAssets: 0,
  totalAssessed: 0,
  dueForRenewal: 0,
  avgBaseLife: 0,
  pctAssessed: 0,
  ...overrides,
});

const group = (name: string, count: number, dueForRenewal: number): GroupRow => ({
  group: name,
  count,
  assessed: 0,
  dueForRenewal,
  pctAssessed: 0,
  share: 0,
});

const cls = (className: string, count: number, dueForRenewal: number): ClassRow => ({
  className,
  count,
  assessed: 0,
  dueForRenewal,
  pctAssessed: 0,
});

const snapshot = (overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot => ({
  filters: { group: null, className: null, kpiFocus: 'all', search: '' },
  kpis: kpis(),
  groups: [],
  classes: [],
  ...overrides,
});

const step = (id: string): Extract<BriefingStep, { target: object }> => {
  const found = FULL_BRIEFING.find((s) => s.id === id);
  if (!found?.target) throw new Error(`No data step ${id}`);
  return found as Extract<BriefingStep, { target: object }>;
};

describe('FULL_BRIEFING', () => {
  const overview = snapshot({
    kpis: kpis({ totalAssets: 12345, avgBaseLife: 38.2, dueForRenewal: 900 }),
    groups: [group('Core', 9000, 100), group('Transport', 2000, 800), group('Utility_Point', 1345, 0)],
  });

  it('narrates the overview from the queried KPIs', () => {
    expect(step('overview').narrate(overview, {})).toContain('12,345 total assets');
    expect(step('overview').narrate(overview, {})).toContain('38.2 years');
  });

  it('focuses the group that actually holds most renewals', () => {
    expect(step('renewal-risk').target({ overview })).toEqual({
      group: 'Transport',
      className: null,
      kpiFocus: 'renewal',
    });
  });

  it('builds the renewal narration from both snapshots', () => {
    const risk = snapshot({
      filters: { group: 'Transport', className: null, kpiFocus: 'renewal', search: '' },
      kpis: kpis({ dueForRenewal: 800 }),
    });
    const text = step('renewal-risk').narrate(risk, { overview });
    expect(text).toContain('900 assets are due for renewal');
    expect(text).toContain('800 of these—89 percent—are concentrated in Transport');
    expect(text).not.toContain('637');
  });

  it('drills into the class with most renewals inside the focused group', () => {
    const risk = snapshot({
      filters: { group: 'Transport', className: null, kpiFocus: 'renewal', search: '' },
      kpis: kpis({ dueForRenewal: 800 }),
      classes: [cls('Bridges', 900, 300), cls('Roads', 1100, 500)],
    });
    expect(step('primary-exposure').target({ overview, 'renewal-risk': risk })).toEqual({
      group: 'Transport',
      className: 'Roads',
      kpiFocus: 'renewal',
    });

    const exposure = snapshot({
      filters: { group: 'Transport', className: 'Roads', kpiFocus: 'renewal', search: '' },
      kpis: kpis({ dueForRenewal: 500, pctAssessed: 0.42 }),
    });
    expect(step('primary-exposure').narrate(exposure, { 'renewal-risk': risk })).toBe(
      'Within Transport, Roads represents your primary capital exposure, accounting for 500 of the 800 urgent renewals in the group. Inspection coverage here is limited at 42 percent.'
    );
  });

  it('skips the drill-down when nothing is due for renewal', () => {
    const calm = snapshot({ groups: [group('Core', 10, 0)] });
    expect(step('renewal-risk').target({ overview: calm })?.group).toBeNull();
    const risk = snapshot({ filters: { group: null, className: null, kpiFocus: 'renewal', search: '' } });
    expect(step('renewal-risk').narrate(risk, { overview: calm })).toMatch(/no assets are currently due/);
    expect(step('primary-exposure').target({ overview: calm, 'renewal-risk': risk })).toBeNull();
  });
});

describe('SECTION_BRIEFINGS', () => {
  it('describes water pipes with the queried numbers', () => {
    const [water] = SECTION_BRIEFINGS.water;
    if (!water?.target) throw new Error('water step must query data');
    const data = snapshot({ kpis: kpis({ totalAssets: 2001, pctAssessed: 0.5, dueForRenewal: 12 }) });
    expect(water.narrate(data, {})).toBe(
      'Focusing on Water Pipes: 2,001 total assets. 50 percent have condition assessments, and 12 are scheduled for renewal.'
    );
  });

  it('says so when the class does not exist', () => {
    const [water] = SECTION_BRIEFINGS.water;
    if (!water?.target) throw new Error('water step must query data');
    expect(water.narrate(snapshot(), {})).toMatch(/could not find any Water Pipes/);
  });
});

describe('parseVoiceCommand', () => {
  it.each([
    ['start the full tour', { type: 'full' }],
    ['stop the briefing', { type: 'reset' }],
    ['reset', { type: 'reset' }],
    ['show me utility lines', { type: 'section', section: 'lines' }],
    ['water pipes please', { type: 'section', section: 'water' }],
    ['what is urgent', { type: 'section', section: 'renewal' }],
    ['show all', { type: 'reset' }],
    ['call me later', null],
    ['pipeline', null],
  ])('%s', (transcript, expected) => {
    expect(parseVoiceCommand(transcript)).toEqual(expected);
  });
});
