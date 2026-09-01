## Current State

A browser-based, client-side-only Pokémon save editor (React + TypeScript +
Vite). Generations I–IV (Red/Blue/Yellow through Diamond/Pearl/Platinum/
HeartGold/SoulSilver) are fully implemented and round-trip tested. Gen III/IV
also support event injection (Mystery Gift Pokémon + ticket/key-item location
unlocks) via a new Events tab. The feature branch
`claude/pokemon-save-editor-m239xy` is currently ahead of `main` (this
session's work isn't merged/deployed yet). A GitHub Actions workflow deploys
`main` to GitHub Pages, pending the repo owner enabling Settings → Pages →
Source → GitHub Actions.

## Recently Completed

- **Event injection for Gen III/IV**: `src/core/events.ts` (types),
  `src/formats/shared/applyEvent.ts`/`eventPid.ts`/`expCurve.ts` (build a
  correctly-encrypted, level-consistent, nature/shiny-locked-as-documented
  Pokemon), `src/data/eventsGen3.ts`/`eventsGen4.ts` (15+21 curated events,
  each verified against real distributed `.pk3`/`.wc4` files and public refs,
  sources cited per-entry), `src/ui/tabs/EventsTab.tsx`. Ticket/key-item
  events only grant the item and let the real game generate the wild
  encounter (more authentic than fabricating a moveset). Item/move/nature
  names are resolved by exact-string lookup against existing name tables at
  load time (`eventHelpers.ts`) instead of hardcoded IDs - this caught real
  transcription mistakes during development (see Gotchas). Also fixed a
  pre-existing bug: Gen4's fateful-encounter bit was always zeroed on write.
  `npm run test:events` validates all 84 catalog×version combinations apply
  with zero warnings and round-trip. Known gaps: Azure Flute excluded (no
  evidence it was ever functional/distributed); ball-caught-in and met-
  location aren't modeled at all (pre-existing editor limitation).
- Shiny editing (Gen II/III/IV) + sprite art from a prior session.
- Created `main` branch + `.github/workflows/deploy-pages.yml`.

## Next Up / In Progress

- Merge `claude/pokemon-save-editor-m239xy` into `main` so this session's
  work actually deploys; user still needs to flip Settings → Pages → Source
  → GitHub Actions (repo owner action, not mine).
- Gen V support — not started. Gen VI+ intentionally out of scope.
- Event catalog could grow — `eventsGen3.ts`/`eventsGen4.ts` follow a clear
  per-entry pattern, low-risk to extend once new data is verified.
- Known gap: Gen IV's item-pocket dropdown (`ItemsTab.tsx`) isn't filtered to
  each pocket's valid whitelist.

## Key Decisions & Gotchas

- **Species ID canonicalization**: `EditablePokemon.speciesId` is always
  National Dex ID (see `gen1SpeciesMap.ts`/`gen3SpeciesMap.ts`).
- Nature/gender stay read-only (PID/DV-derived) except Gen IV ability+gender
  (directly stored) and shininess (Gen II-IV, editable - `shinyEdit.ts`).
- Box-stored Pokémon in Gen III/IV have no independent level field.
- **Never zero-fill-and-forget**: `toBytes()` clones original bytes and
  patches only known offsets.
- Detection is structural, not size-based. Round-trip tests use synthetic
  saves only (no copyrighted files in repo).
- **Never work from memory for save-affecting facts.** Bit twice this
  session even with that rule in mind: hand-derived nature IDs were wrong
  (wrong index table from memory), and one item name used a straight
  apostrophe where the real table has a curly one. Both caught by resolving
  names against actual data tables at load time instead of hardcoding IDs -
  reuse that pattern (`eventHelpers.ts`) for future ID-bearing data.
- **SaveFile.versionTag** (new): short internal version code ('RS'|'E'|'FRLG'
  gen3, 'DP'|'Pt'|'HGSS' gen4) for event-catalog filtering; undefined gen1/2.

## Relevant Files

- `README.md` — status table, commands. `src/core/types.ts` — shared
  contract. `src/core/events.ts` — event type contract.
  `src/core/registry.ts` — format detection.
- `src/formats/genN/save.ts` — per-gen save entry point.
  `src/formats/shared/` — cross-gen logic incl. `applyEvent.ts`/`eventPid.ts`/
  `expCurve.ts`/`shinyEdit.ts`.
- `src/data/eventsGen3.ts`/`eventsGen4.ts`/`eventHelpers.ts` — event catalogs.
  `src/ui/tabs/EventsTab.tsx` — event picker/injector UI.
  `src/ui/tabs/ItemsTab.tsx` — has the known Gen IV whitelist gap.
- `.github/workflows/deploy-pages.yml` — Pages deploy, pending repo setting.
  `scripts/genN-roundtrip-test.mjs`/`events-roundtrip-test.mjs` — tests.
