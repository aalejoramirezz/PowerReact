import type { DashboardSnapshot } from '../../lib/dax/types';
import type { FocusTarget } from '../../store/filters';

/** Snapshots of the steps already narrated in this run, keyed by step id. */
export type BriefingHistory = Readonly<Record<string, DashboardSnapshot>>;

export type BriefingStep =
  | {
      id: string;
      title: string;
      /** Filters to apply before narrating, derived from earlier steps; null skips the step. */
      target: (history: BriefingHistory) => FocusTarget | null;
      /** Narration built from the data actually returned for `target`. */
      narrate: (data: DashboardSnapshot, history: BriefingHistory) => string;
    }
  | {
      id: string;
      title: string;
      target?: undefined;
      narrate: () => string;
    };

export type BriefingSection = 'lines' | 'water' | 'renewal';

const fmt = (n: number) => n.toLocaleString('en-US');
const percent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)} percent`;
const listFormat = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

export const humanize = (name: string) => name.replace(/_/g, ' ');

/** Row with the highest positive value, if any. */
function topBy<T>(rows: readonly T[], pick: (row: T) => number): T | undefined {
  return rows.reduce<T | undefined>(
    (best, row) => (pick(row) > 0 && (!best || pick(row) > pick(best)) ? row : best),
    undefined
  );
}

function coverageLabel(fraction: number): string {
  if (fraction >= 0.8) return 'robust';
  if (fraction >= 0.5) return 'moderate';
  return 'limited';
}

const PORTFOLIO: FocusTarget = { group: null, className: null, kpiFocus: 'all' };

export const FULL_BRIEFING: BriefingStep[] = [
  {
    id: 'overview',
    title: 'Executive Overview',
    target: () => PORTFOLIO,
    narrate: ({ kpis }) =>
      `Good morning. Welcome to your executive briefing for AssetFinda. You currently manage ${fmt(kpis.totalAssets)} total assets across the portfolio, with an average base life of ${kpis.avgBaseLife} years.`,
  },
  {
    id: 'condition',
    title: 'Condition Assessment',
    target: () => ({ ...PORTFOLIO, kpiFocus: 'assessed' }),
    narrate: ({ kpis }) =>
      `Regarding operational condition: ${fmt(kpis.totalAssessed)} assets—representing ${percent(kpis.pctAssessed)} of your active portfolio—have completed condition assessments.`,
  },
  {
    id: 'renewal-risk',
    title: 'Renewal Risk Concentration',
    // Focus the group that actually holds the most renewals in the overview data
    target: (history) => ({
      group: topBy(history.overview?.groups ?? [], (g) => g.dueForRenewal)?.group ?? null,
      className: null,
      kpiFocus: 'renewal',
    }),
    narrate: (data, history) => {
      const total = history.overview?.kpis.dueForRenewal ?? data.kpis.dueForRenewal;
      const group = data.filters.group;
      if (total === 0 || !group) {
        return 'Good news: no assets are currently due for renewal across the portfolio.';
      }
      const inGroup = data.kpis.dueForRenewal;
      return `However, attention is required: ${fmt(total)} assets are due for renewal. ${fmt(inGroup)} of these—${percent(inGroup / total, 0)}—are concentrated in ${humanize(group)}. Let me isolate this group for you now.`;
    },
  },
  {
    id: 'primary-exposure',
    title: 'Primary Exposure',
    target: (history) => {
      const risk = history['renewal-risk'];
      const group = risk?.filters.group;
      const topClass = risk ? topBy(risk.classes, (c) => c.dueForRenewal) : undefined;
      return group && topClass ? { group, className: topClass.className, kpiFocus: 'renewal' } : null;
    },
    narrate: (data, history) => {
      const group = humanize(data.filters.group ?? '');
      const cls = humanize(data.filters.className ?? '');
      const due = data.kpis.dueForRenewal;
      const groupDue = history['renewal-risk']?.kpis.dueForRenewal ?? due;
      const share =
        due === groupDue
          ? `accounting for all ${fmt(due)} urgent renewals in the group`
          : `accounting for ${fmt(due)} of the ${fmt(groupDue)} urgent renewals in the group`;
      const coverage = data.kpis.pctAssessed;
      return `Within ${group}, ${cls} represents your primary capital exposure, ${share}. Inspection coverage here is ${coverageLabel(coverage)} at ${percent(coverage, 0)}.`;
    },
  },
  {
    id: 'conclusion',
    title: 'Conclusion',
    narrate: () =>
      'This concludes your guided briefing. You can now explore the cross-filtered model freely, or ask to focus on any other asset category.',
  },
];

export const SECTION_BRIEFINGS: Record<BriefingSection, BriefingStep[]> = {
  lines: [
    {
      id: 'lines',
      title: 'Utility Lines Concentration',
      target: () => ({ group: 'Utility_Line', className: null, kpiFocus: 'all' }),
      narrate: ({ kpis, classes }) => {
        if (kpis.totalAssets === 0) return 'I could not find any Utility Line assets in the current model.';
        const names = classes.slice(0, 3).map((c) => humanize(c.className));
        const across = names.length > 0 ? ` across ${listFormat.format(names)}` : '';
        return `Filtering to Utility Lines: you have ${fmt(kpis.totalAssets)} assets${across}. ${fmt(kpis.dueForRenewal)} assets are flagged for urgent renewal.`;
      },
    },
  ],
  water: [
    {
      id: 'water',
      title: 'Water Pipes Exposure',
      target: () => ({ group: 'Utility_Line', className: 'Water_Pipes', kpiFocus: 'all' }),
      narrate: ({ kpis }) =>
        kpis.totalAssets === 0
          ? 'I could not find any Water Pipes assets in the current model.'
          : `Focusing on Water Pipes: ${fmt(kpis.totalAssets)} total assets. ${percent(kpis.pctAssessed, 0)} have condition assessments, and ${fmt(kpis.dueForRenewal)} are scheduled for renewal.`,
    },
  ],
  renewal: [
    {
      id: 'renewal',
      title: 'Urgent Renewals',
      target: () => ({ group: null, className: null, kpiFocus: 'renewal' }),
      narrate: ({ kpis, classes }) => {
        if (kpis.dueForRenewal === 0) return 'Good news: no asset classes currently require renewal.';
        const top = topBy(classes, (c) => c.dueForRenewal);
        const lead = top ? `, led by ${humanize(top.className)} with ${fmt(top.dueForRenewal)}` : '';
        return `Displaying the asset classes with urgent renewal requirements: ${fmt(kpis.dueForRenewal)} assets across your operational network${lead}.`;
      },
    },
  ],
};

export type VoiceCommand = { type: 'full' } | { type: 'section'; section: BriefingSection } | { type: 'reset' };

/** Maps a recognized phrase to an action; stop/reset wins over everything else. */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const cmd = transcript.toLowerCase();
  if (/\b(reset|stop|cancel)\b/.test(cmd)) return { type: 'reset' };
  if (/\b(full|briefing|tour|start)\b/.test(cmd)) return { type: 'full' };
  if (/\b(utility lines?|lines?)\b/.test(cmd)) return { type: 'section', section: 'lines' };
  if (/\b(water|pipes?)\b/.test(cmd)) return { type: 'section', section: 'water' };
  if (/\b(renewals?|urgent)\b/.test(cmd)) return { type: 'section', section: 'renewal' };
  if (/\ball\b/.test(cmd)) return { type: 'reset' };
  return null;
}
