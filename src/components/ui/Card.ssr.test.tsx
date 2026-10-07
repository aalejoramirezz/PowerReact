import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartCard } from './Card';

/** The React card stays for non-visual surfaces; the visuals themselves are web components. */
describe('ChartCard', () => {
  it('exposes the curtain through an ⓘ button, closed by default', () => {
    const out = renderToStaticMarkup(
      <ChartCard title="T" info="Means X." calc="Y">
        <p>chart</p>
      </ChartCard>
    );
    expect(out).toContain('What it means');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-open="false"');
  });
});
