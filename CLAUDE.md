# CLAUDE.md

## Session workflow (read this first)

- **At the start of every session/task**: read `/handoff.md` before doing
  anything else in the repo. Do NOT re-read the whole codebase if
  `handoff.md` already covers what's needed — only open additional files
  if the task requires details `handoff.md` doesn't have.
- **Before ending a task**, or whenever the user says "wrap up" or "update
  handoff": update `/handoff.md` — revise Current State, move finished
  items into Recently Completed, update Next Up, add any new gotchas or
  decisions. Keep it under ~500 words: trim stale entries, don't just
  append forever.

## Project

Pokémon Save Editor — a browser-based, client-side-only save file editor.
No backend, no upload: everything happens in the user's browser.

## Stack

- React + TypeScript, built with Vite.
- No UI framework/component library — plain CSS.
- No test framework — round-trip validation scripts run directly via `tsx`
  (see Commands below), not Jest/Vitest.

## Commands

```bash
npm install
npm run dev        # dev server (localhost:5173)
npm run build      # type-check (tsc -b) + production build
npm run lint        # oxlint
npm run test:gen1   # ...gen2, gen3, gen4 — synthetic round-trip test per generation
```

Always run the relevant `test:genN` script(s) after touching a generation's
format module, and `npm run build` before considering a change done (it
type-checks and builds in one step).

## Architecture

- `src/core/types.ts` — the shared contract (`SaveFile`, `EditablePokemon`,
  `GenerationCapabilities`) every generation module implements.
- `src/core/registry.ts` — format auto-detection; new generation modules
  register here.
- `src/formats/genN/` — one module per generation. Each implements
  `detect(bytes)` + `load(bytes)` and produces a `SaveFile` whose
  `toBytes()` re-serializes in-memory edits back into a valid save,
  recomputing every checksum/encryption layer that generation needs.
- `src/formats/shared/` — logic genuinely shared across generations
  (don't duplicate into a `genN/` folder if it belongs here).
- `src/data/` — name tables (species/moves/items/abilities/natures) and
  per-generation base stat tables, generated from verified reference data.
- `src/ui/` — React editor UI, generic across generations via
  `SaveFile.capabilities` (a component should branch on `capabilities`
  flags, not on `generation` number, wherever possible).

## Conventions

- `EditablePokemon.speciesId` is always the **National Dex ID**, regardless
  of what a generation's raw save format uses internally. Convert at the
  format-module boundary (see `gen1SpeciesMap.ts` / `gen3SpeciesMap.ts` for
  the two generations that need it).
- A generation module's `toBytes()` must start from a full clone of the
  original imported bytes and patch only known offsets — never zero-fill
  the whole buffer. Fields the editor doesn't model must survive edits to
  unrelated data untouched.
- A field this editor can't safely make independently editable (usually
  because it's derived from a Pokémon's PID) is shown **read-only** in the
  UI, never silently dropped or silently no-op'd on save.
- `detect()` for a format must be structural (e.g. list-header validity),
  not just a size or checksum check — some generations share an identical
  file size, and checksum-only checks risk cross-generation false positives.
- Before implementing a new generation's byte offsets/algorithms, verify
  them against independent public references rather than working from
  memory — get this wrong and the result is a corrupted save, not just a
  bug.
- No copyrighted save files or ROM data in the repo. Round-trip tests
  construct synthetic saves with hand-built valid headers/checksums.

## Out of scope (for now)

Gen V (Black/White/B2W2) is unimplemented. Gen VI+ (3DS/Switch) is
intentionally not planned — console-specific encryption raises the risk of
producing a save-corrupting implementation too high to be worth it here.
Event injection (setting in-game event flags) is deferred until more
generations are solid. See `handoff.md` for current status and
`README.md` for the full per-generation support table.
