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

  it('toggles a selection on, replaces it on the same column, and off when clicked again', () => {
    state().toggleCrossFilter('d1', 'groups', [{ field: GROUP, value: 'Core' }]);
    expect(cross('d1')).toEqual([{ field: GROUP, values: ['Core'], labels: ['Core'], sourceVisualId: 'groups', origin: 'select' }]);
    state().toggleCrossFilter('d1', 'donut', [{ field: 'asset_class_group[Asset_Class_Group]', value: 'Transport' }]);
    expect(cross('d1').map((f) => f.values)).toEqual([['Transport']]);
    state().toggleCrossFilter('d1', 'classes', [{ field: CLASS, value: 'Bridges' }]);
    expect(cross('d1')).toHaveLength(2);
    state().toggleCrossFilter('d1', 'groups', [{ field: GROUP, value: 'Transport' }]);
    expect(cross('d1').map((f) => f.values)).toEqual([['Bridges']]);
  });

  it('applies every dimension of a click in one update, and removes them together', () => {
    const core = { field: GROUP, value: 'Core', label: 'Core' };
    state().toggleCrossFilter('d1', 'matrix', [core, { field: CLASS, value: 'Buildings' }]);
    expect(cross('d1').map((f) => [f.field, f.values])).toEqual([
      [GROUP, ['Core']],
      [CLASS, ['Buildings']],
    ]);
    // Another cell of the same row: both columns follow the new cell
    state().toggleCrossFilter('d1', 'matrix', [core, { field: CLASS, value: 'Bridges' }]);
    expect(cross('d1').map((f) => f.values[0])).toEqual(['Core', 'Bridges']);
    state().toggleCrossFilter('d1', 'matrix', [core, { field: CLASS, value: 'Bridges' }]);
    expect(cross('d1')).toEqual([]);
  });

  it('keeps a slicer apart from a selection on the same column', () => {
    state().setSlicerFilter('d1', { field: GROUP, values: ['Core', 'Transport'], sourceVisualId: 'group-slicer' });
    state().toggleCrossFilter('d1', 'groups', [{ field: GROUP, value: 'Core' }]);
    expect(cross('d1').map((f) => [f.origin, f.values])).toEqual([
      ['slicer', ['Core', 'Transport']],
      ['select', ['Core']],
    ]);
    state().clearCrossFilter('d1', GROUP, 'select');
    expect(cross('d1').map((f) => f.origin)).toEqual(['slicer']);
    state().setSlicerFilter('d1', { field: GROUP, values: ['Transport'], sourceVisualId: 'group-slicer' });
    expect(cross('d1').map((f) => f.values)).toEqual([['Transport']]);
    state().setSlicerFilter('d1', { field: GROUP, values: [], sourceVisualId: 'group-slicer' });
    expect(cross('d1')).toEqual([]);
  });

  it('keeps dashboards apart and clears one column, one dashboard or everything', () => {
    state().toggleCrossFilter('d1', 'groups', [{ field: GROUP, value: 'Core' }]);
    state().toggleCrossFilter('d1', 'classes', [{ field: CLASS, value: 'Buildings' }]);
    state().toggleCrossFilter('d2', 'groups', [{ field: GROUP, value: 'Core' }]);
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
