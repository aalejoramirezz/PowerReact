# CLAUDE.md

The instructions for every AI coding agent working in this repository are in [AGENTS.md](AGENTS.md). Read it first and follow it exactly.

In particular:
- Before any UI or visual work, load the `powerreact-design-system` skill; before wiring data to a visual, also load `powerreact-visual-builder`.
- For interaction, motion and polish also load the vendored `better-ui` and `emil-design-eng` skills; the Univerus contract takes precedence over them.
- Skills live in `.agents/skills/` (canonical) and are mirrored to `.claude/skills/` by `npm run skills:sync`; never edit the mirror.
- Colours come only from `src/theme/tokens.css`; every change must work in both themes (Neo-Glass and Nocturne).
- Conversation may be in the user's language (e.g. Spanish); code, UI copy, docs and commits are in English.
- Lint, typecheck, unit and E2E tests must pass before hand-over.
