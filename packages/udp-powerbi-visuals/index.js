// The package root only carries types (dist/types/index.d.ts); the elements are imported from
// `@powerreact/udp-powerbi-visuals/components/<tag>.js`. This empty module exists because Vite keeps
// the generated React wrappers' type-only import (`import { type … } from '@powerreact/udp-powerbi-visuals'`)
// as `import '@powerreact/udp-powerbi-visuals'` (verbatimModuleSyntax): it must resolve to something
// that is always there and loads nothing, whatever the state of the build output.
export {};
