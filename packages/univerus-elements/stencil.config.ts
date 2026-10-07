import type { Config } from '@stencil/core';
import { reactOutputTarget } from '@stencil/react-output-target';

/**
 * Univerus visuals as presentational web components.
 *
 *  components/  custom elements for bundlers (what the React wrappers import)
 *  hydrate/     server-side renderer, used by the SSR smoke tests in Vitest
 *  docs/        components.json: tags, props and events, cross-checked against the manifest schema
 *  ../../src/components/univerus/generated  React 18 wrappers (@lit/react), regenerated on every build
 *
 * `empty: false`: a build overwrites its files in place instead of emptying the folder first.
 * `npm run dev` runs `stencil --watch` next to Vite (and an IDE may run `npm test`, which builds
 * too); an emptied folder made Vite fail with "Failed to resolve import" until the build finished.
 * Old hashed chunks (`p-*.js`) can linger; nothing imports them and the folder is ignored by git.
 */
export const config: Config = {
  namespace: 'univerus',
  srcDir: 'src',
  outputTargets: [
    {
      type: 'dist-custom-elements',
      dir: 'components',
      empty: false,
      externalRuntime: false,
      customElementsExportBehavior: 'single-export-module',
      generateTypeDeclarations: true,
    },
    { type: 'dist-hydrate-script', dir: 'hydrate', empty: false },
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
