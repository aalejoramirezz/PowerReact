// The package root only carries types (dist/types/index.d.ts); the elements are imported from
// `@powerreact/univerus-elements/components/<tag>.js`. This empty module exists because Vite keeps
// the generated React wrappers' type-only import (`import { type … } from '@powerreact/univerus-elements'`)
// as `import '@powerreact/univerus-elements'` (verbatimModuleSyntax): it must resolve to something
// that is always there and loads nothing, whatever the state of the build output.
export {};
