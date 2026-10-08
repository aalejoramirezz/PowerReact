import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTROL_COMPONENTS, elementTag, MANIFEST_COMPONENTS } from '../../lib/manifest/schema';

/**
 * A manifest can only name components that exist: every name in the Zod schema must be a
 * udp-powerbi-visuals element Stencil built, with the props and events the manifest engine relies on
 * (except the controls the container draws itself, e.g. the slicer). (The React
 * wrapper map in registry.tsx is checked at compile time with `satisfies`.)
 */
interface DocsJson {
  components: Array<{ tag: string; props: Array<{ name: string }>; events: Array<{ event: string }> }>;
}

const docs = JSON.parse(readFileSync('packages/udp-powerbi-visuals/docs/components.json', 'utf8')) as DocsJson;
const byTag = new Map(docs.components.map((c) => [c.tag, c]));

const COMMON_PROPS = ['visualId', 'heading', 'info', 'calc', 'format', 'loading', 'error', 'stale', 'exportable', 'exportFormats', 'exportFileName', 'exportRows', 'focusable', 'theme', 'index'];
const CHART_PROPS = ['subheading', 'emptyMessage', 'selectedValue', 'crossFilterField', 'interactive', 'testIdPrefix', 'frame'];
const controls: readonly string[] = CONTROL_COMPONENTS;
const ELEMENTS = MANIFEST_COMPONENTS.filter((name) => !controls.includes(name));
const EVENTS = ['dataPointClick', 'exportData', 'focusModeChange', 'viewChange'];

describe('manifest component registry', () => {
  it.each(ELEMENTS)('%s is a built udp-powerbi-visuals element with the shared contract', (name) => {
    const element = byTag.get(elementTag(name));
    expect(element, `<${elementTag(name)}> missing from docs/components.json`).toBeDefined();
    const props = new Set(element?.props.map((p) => p.name));
    const isKpi = name === 'UniverusKpiCard' || name === 'UniverusKpiHero';
    for (const prop of [...COMMON_PROPS, ...(isKpi ? [] : CHART_PROPS)]) expect(props.has(prop), `${name}.${prop}`).toBe(true);
    expect(element?.events.map((e) => e.event).sort()).toEqual([...EVENTS].sort());
  });

  it('every built element can be named in a manifest', () => {
    expect([...byTag.keys()].sort()).toEqual(ELEMENTS.map(elementTag).sort());
  });
});
