import type { Config } from '@stencil/core';
import { reactOutputTarget } from '@stencil/react-output-target';

/**
 * Univerus visuals as presentational web components.
 *
 *  components/  custom elements for bundlers (what the React wrappers import)
 *  hydrate/     server-side renderer, used by the SSR smoke tests in Vitest
 *  docs/        components.json: tags, props and events, cross-checked against the manifest schema
 *  ../../src/components/univerus/generated  React 18 wrappers (@lit/react), regenerated on every build
 */
export const config: Config = {
  namespace: 'univerus',
  srcDir: 'src',
  outputTargets: [
    {
      type: 'dist-custom-elements',
      dir: 'components',
      externalRuntime: false,
      customElementsExportBehavior: 'single-export-module',
      generateTypeDeclarations: true,
    },
    { type: 'dist-hydrate-script', dir: 'hydrate' },
    { type: 'docs-json', file: 'docs/components.json' },
    reactOutputTarget({
      outDir: '../../src/components/univerus/generated',
      stencilPackageName: '@powerreact/univerus-elements',
      customElementsDir: 'components',
    }),
  ],
  // The package is consumed from source through the workspace: no npm publishing checks
  validatePrimaryPackageOutputTarget: false,
};
