# GEMINI.md

The instructions for every AI coding agent working in this repository are in [AGENTS.md](AGENTS.md). Read it first and follow it exactly.

In particular:
- Skills live in `.agents/skills/` (canonical): read `powerreact-design-system` before any UI work and `powerreact-visual-builder` before wiring data to a visual.
- Colours come only from `src/theme/tokens.css`; every change must work in both themes (Neo-Glass and Nocturne).
- Conversation may be in the user's language (e.g. Spanish); code, UI copy, docs and commits are in English.
- Lint, typecheck, unit and E2E tests must pass before hand-over.
