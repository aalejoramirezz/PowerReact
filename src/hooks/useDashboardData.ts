import type { QueryClient } from '@tanstack/react-query';
import { buildClassesQuery, buildGroupsQuery, buildKpiQuery } from '../lib/dax/daxBuilder';
import { parseClasses, parseGroups, parseKpis } from '../lib/dax/parse';
import type { DashboardFilters, DashboardSnapshot } from '../lib/dax/types';
import { semanticQueryOptions, useSemanticQuery } from './useSemanticQuery';

function dashboardQuerySpecs(filters: DashboardFilters) {
  const scope = `${filters.group ?? 'All Groups'}${filters.className ? ` > ${filters.className}` : ''}`;
  return {
    kpis: { kind: 'kpis', title: `KPIs (${scope})`, dax: buildKpiQuery(filters), parse: parseKpis },
    groups: { kind: 'groups', title: 'Asset Groups Summary', dax: buildGroupsQuery(filters), parse: parseGroups },
    classes: {
      kind: 'classes',
      title: `Top Classes (${filters.group ?? 'Global'})`,
      dax: buildClassesQuery(filters),
      parse: parseClasses,
    },
  };
}

export function useDashboardData(filters: DashboardFilters) {
  const specs = dashboardQuerySpecs(filters);
  return {
    kpis: useSemanticQuery(specs.kpis),
    groups: useSemanticQuery(specs.groups),
    classes: useSemanticQuery(specs.classes),
  };
}

/**
 * Resolves once every visual's data for `filters` is in the cache. Shares in-flight
 * requests with the mounted visuals, so awaiting it never doubles the DAX traffic.
 */
export async function loadDashboard(queryClient: QueryClient, filters: DashboardFilters): Promise<DashboardSnapshot> {
  const specs = dashboardQuerySpecs(filters);
  const [kpis, groups, classes] = await Promise.all([
    queryClient.fetchQuery(semanticQueryOptions(specs.kpis)),
    queryClient.fetchQuery(semanticQueryOptions(specs.groups)),
    queryClient.fetchQuery(semanticQueryOptions(specs.classes)),
  ]);
  return { filters, kpis, groups, classes };
}
