## Current State

A browser-based, client-side-only Pokémon save editor (React + TypeScript +
Vite). Generations I–IV (Red/Blue/Yellow through Diamond/Pearl/Platinum/
HeartGold/SoulSilver) are fully implemented and round-trip tested. Gen III/IV
also support event injection (Mystery Gift Pokémon + ticket/key-item location
unlocks) via an Events tab. `main` and `claude/pokemon-save-editor-m239xy`
are in sync as of the last push. Distributable beyond the live site: a
single self-contained HTML file (`npm run build:standalone`) and desktop
installers (.exe/.app/.AppImage) built by CI on a `v*` tag push - see
"Getting it without building from source" in README.md. GitHub Pages deploy
is pending the repo owner enabling Settings → Pages → Source → GitHub Actions.

## Recently Completed

- **Downloadable distribution**: `npm run build:standalone` (vite-plugin-
  singlefile + a favicon-inlining postprocess script) produces one
  self-contained HTML file that runs via `file://` with no server - verified
  by loading it directly in a headless browser, and linked from the import
  screen. `electron/main.cjs` wraps that same build in a sandboxed Electron
  window (verified locally: built + launched the packaged Linux binary under
  Xvfb). `.github/workflows/build-desktop.yml` builds Windows/macOS/Linux
  installers via electron-builder on a `v*` tag push (or manual dispatch)
  and attaches them to a GitHub Release. Binaries are unsigned, so
  SmartScreen/Gatekeeper will warn on first run - documented in README.
- **Event injection for Gen III/IV**: `src/core/events.ts` (types),
  `src/formats/shared/applyEvent.ts`/`eventPid.ts`/`expCurve.ts`, curated
  catalogs in `src/data/eventsGen3.ts`/`eventsGen4.ts` (15+21 events, each
  verified against real distributed `.pk3`/`.wc4` files and public refs),
  `src/ui/tabs/EventsTab.tsx`. Item/move/nature names resolve by exact-
  string lookup against existing name tables at load time (`eventHelpers.ts`)
  instead of hardcoded IDs. `npm run test:events` validates all 84 catalog×
  version combinations. Known gaps: Azure Flute excluded (never actually
  functional/distributed); ball-caught-in/met-location aren't modeled at all
  (pre-existing editor limitation).
- Shiny editing (Gen II/III/IV) + sprite art from an earlier session.

## Next Up / In Progress

- User needs to flip Settings → Pages → Source → GitHub Actions (repo owner
  action) before Pages deploys; and push a `v*` tag (or run the desktop
  workflow manually) to actually produce downloadable installers - neither
  has happened yet as of this session.
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
  patches only known offsets. Detection is structural, not size-based.
  Round-trip tests use synthetic saves only (no copyrighted files in repo).
- **Never work from memory for save-affecting facts.** Bit twice during
  event-catalog work even with that rule in mind (wrong nature IDs from a
  misremembered index table; a straight vs. curly apostrophe mismatch on an
  item name) - both caught by resolving names against actual data tables at
  load time instead of hardcoding IDs (`eventHelpers.ts` pattern).
- **SaveFile.versionTag** ('RS'|'E'|'FRLG' gen3, 'DP'|'Pt'|'HGSS' gen4) for
  event-catalog filtering; undefined for gen1/2.
- The desktop app deliberately loads the *standalone* build, not the regular
  multi-asset `dist/`, so there's no root-relative asset path to resolve
  under `file://`/packaged-app loading.

## Relevant Files

- `README.md` — status table, distribution options, commands.
  `src/core/types.ts`/`events.ts` — shared contracts. `src/core/registry.ts`.
- `src/formats/genN/save.ts` — per-gen save entry point. `src/formats/shared/`
  — cross-gen logic incl. event injection + `shinyEdit.ts`.
- `src/data/eventsGen3.ts`/`eventsGen4.ts`/`eventHelpers.ts` — event catalogs.
  `src/ui/tabs/EventsTab.tsx`. `src/ui/tabs/ItemsTab.tsx` — known whitelist gap.
- `vite.config.ts` — STANDALONE env flag for the single-file build.
  `electron/main.cjs` — desktop shell. `.github/workflows/` — Pages deploy +
  desktop-installer build.
- `scripts/genN-roundtrip-test.mjs`/`events-roundtrip-test.mjs` — tests.
