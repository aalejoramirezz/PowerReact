import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_FILTERS, selectFilters, useFilterStore } from './filters';

const state = () => useFilterStore.getState();

describe('filter store', () => {
  beforeEach(() => state().resetAll());

  it('selecting a group clears the class picked under the previous group', () => {
    state().toggleGroup('Utility_Line');
    state().toggleClass('Water_Pipes');
    state().toggleGroup('Core');
    expect(selectFilters(state())).toMatchObject({ group: 'Core', className: null });
  });

  it('toggling the selected group unselects it', () => {
    state().toggleGroup('Core');
    state().toggleGroup('Core');
    expect(state().group).toBeNull();
  });

  it('KPI focus toggles back to all', () => {
    state().toggleKpiFocus('renewal');
    expect(state().kpiFocus).toBe('renewal');
    state().toggleKpiFocus('renewal');
    expect(state().kpiFocus).toBe('all');
  });

  it('clearScope keeps focus and search', () => {
    state().toggleGroup('Core');
    state().toggleKpiFocus('assessed');
    state().setSearch('pipe');
    state().clearScope();
    expect(selectFilters(state())).toEqual({ group: null, className: null, kpiFocus: 'assessed', search: 'pipe' });
  });

  it('focus applies a whole target atomically and returns it', () => {
    state().setSearch('pipe');
    const next = state().focus({ group: 'Utility_Line', className: 'Water_Pipes', kpiFocus: 'renewal' });
    expect(next).toEqual({ group: 'Utility_Line', className: 'Water_Pipes', kpiFocus: 'renewal', search: '' });
    expect(selectFilters(state())).toEqual(next);
  });

  it('resetAll restores the initial filters', () => {
    state().focus({ group: 'Core', className: 'Buildings', kpiFocus: 'renewal' });
    state().resetAll();
    expect(selectFilters(state())).toEqual(INITIAL_FILTERS);
  });
});

describe('manifest cross-filters', () => {
  const GROUP = "'asset_class_group'[Asset_Class_Group]";
  const CLASS = "'asset_class'[Asset_Class]";
  const cross = (id: string) => state().crossFilters[id] ?? [];

  beforeEach(() => state().resetAll());

  it('toggles a value on, replaces it on the same column, and off when clicked again', () => {
    state().toggleCrossFilter('d1', { field: GROUP, value: 'Core', sourceVisualId: 'groups' });
    expect(cross('d1')).toEqual([{ field: GROUP, value: 'Core', sourceVisualId: 'groups' }]);
    state().toggleCrossFilter('d1', { field: 'asset_class_group[Asset_Class_Group]', value: 'Transport', sourceVisualId: 'donut' });
    expect(cross('d1').map((f) => f.value)).toEqual(['Transport']);
    state().toggleCrossFilter('d1', { field: CLASS, value: 'Bridges', sourceVisualId: 'classes' });
    expect(cross('d1')).toHaveLength(2);
    state().toggleCrossFilter('d1', { field: GROUP, value: 'Transport', sourceVisualId: 'groups' });
    expect(cross('d1').map((f) => f.value)).toEqual(['Bridges']);
  });

  it('keeps dashboards apart and clears one column, one dashboard or everything', () => {
    state().toggleCrossFilter('d1', { field: GROUP, value: 'Core', sourceVisualId: 'groups' });
    state().toggleCrossFilter('d1', { field: CLASS, value: 'Buildings', sourceVisualId: 'classes' });
    state().toggleCrossFilter('d2', { field: GROUP, value: 'Core', sourceVisualId: 'groups' });
    state().clearCrossFilter('d1', GROUP);
    expect(cross('d1').map((f) => f.field)).toEqual([CLASS]);
    expect(cross('d2')).toHaveLength(1);
    state().clearDashboard('d1');
    expect(state().crossFilters).not.toHaveProperty('d1');
    state().toggleGroup('Core');
    state().resetAll();
    expect(state().crossFilters).toEqual({});
    expect(selectFilters(state())).toEqual(INITIAL_FILTERS);
  });
});
