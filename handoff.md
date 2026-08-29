## Current State

A browser-based, client-side-only Pokémon save editor (React + TypeScript +
Vite). Generations I–IV (Red/Blue/Yellow through Diamond/Pearl/Platinum/
HeartGold/SoulSilver) are fully implemented and round-trip tested: import a
real save, edit trainer/party/boxes/items, export a valid save back out,
with all checksums/encryption recomputed correctly. Each generation module
has an automated round-trip test and was verified against a real headless
browser session (import → edit → export). `main` and the feature branch
`claude/pokemon-save-editor-m239xy` are in sync as of the last push. A
GitHub Actions workflow deploys `main` to GitHub Pages, pending the repo
owner enabling Settings → Pages → Source → GitHub Actions (one-time,
can't be done via API/tooling).

## Recently Completed

- Shiny editing (Gen II/III/IV; Gen I has no shininess mechanic) + sprite
  art. `src/formats/shared/shinyEdit.ts` holds the toggle logic: Gen II
  adjusts the Atk/Def/Spe/Special DVs that determine shininess there (can
  nudge those stats slightly, same as in-game); Gen III/IV regenerate the
  PID, searching for one that flips shininess vs. trainer/secret ID while
  keeping the PID's low byte fixed (preserves Gen III's PID-derived gender)
  and `% 25` fixed (preserves nature - Gen III ability is stored
  independently of PID already, unaffected). Not handled: Gen III Unown's
  letter is also PID-derived and could shift (niche, skipped).
  `src/data/spriteUrl.ts` hotlinks official art from PokeAPI's public
  sprite CDN by National Dex ID (box/party thumbnails + editor header;
  hides gracefully on load failure). test:genN scripts assert the toggle
  round-trips. Verified live in a dev server (checkbox, state, `<img src>`)
  except actual sprite pixels — this sandbox's egress proxy resets
  Chromium's connection to that CDN host (curl to the same URL works fine,
  likely an HTTP/2-over-proxy sandbox quirk), not expected to affect real
  users' browsers.
- Created `main` branch and `.github/workflows/deploy-pages.yml` +
  `vite.config.ts` base-path fix for GitHub Pages.

## Next Up / In Progress

Nothing actively in progress. Open threads, not yet started:
- Gen V (Black/White/Black2/White2) support — not started.
- Event injection (setting in-game event flags, not just item drops) —
  explicitly deferred until more generations were solid; still deferred.
- Gen VI+ (3DS/Switch) — intentionally out of scope (console-specific
  encryption, high risk of save corruption); see `README.md` status table.
- Minor known gap: Gen IV's item-pocket dropdown in
  `src/ui/tabs/ItemsTab.tsx` isn't filtered to each pocket's valid item
  whitelist, so picking an invalid item for a pocket silently no-ops on
  export instead of being flagged in the UI.
- User needs to flip Settings → Pages → Source → GitHub Actions on GitHub
  before the Pages deploy will succeed (repo owner action, not mine).

## Key Decisions & Gotchas

- **Species ID canonicalization**: `EditablePokemon.speciesId` is always
  National Dex ID. Gen I/III use different internal numbering in the save
  itself — see `gen1SpeciesMap.ts` / `gen3SpeciesMap.ts` (cross-checked,
  zero mismatches). Gen II/IV store National Dex ID directly.
- **Nature and gender stay read-only** (PID/DV-derived) — regenerating them
  isn't implemented, shown disabled not dropped. **Shininess is now
  editable** (Gen II-IV, see Recently Completed). Gen III ability looks
  PID-derived but is actually stored independently in the save, so PID
  edits don't touch it; Gen IV ability+gender are directly stored/editable.
- **Box-stored Pokémon in Gen III/IV have no independent level field**
  (only Experience) — Level is read-only for boxed (non-party) mons there.
- **Never zero-fill-and-forget**: every format's `toBytes()` clones the
  original bytes and patches only known offsets, so unmodeled fields
  (contest stats, ribbons, etc.) survive edits to *other* Pokémon.
- **Detection is structural, not size-based**: Gen I/II international
  saves are both exactly 0x8000 bytes, so `detect()` checks list-header
  validity before trusting a checksum — avoids cross-gen false positives.
- **Round-trip tests use synthetic saves** (no copyrighted files in repo)
  with hand-built valid headers/checksums — see `scripts/genN-roundtrip-test.mjs`
  for the pattern when adding Gen V.
- All Gen1-4 offsets/algorithms were cross-checked against independent
  public references before implementation, not worked from memory alone.

## Relevant Files

- `README.md` — per-generation status table, known limitations, commands.
- `src/core/types.ts` — shared `SaveFile`/`EditablePokemon`/
  `GenerationCapabilities` contract; start here before touching a generation.
- `src/core/registry.ts` — format auto-detection; register new gens here.
- `src/formats/genN/save.ts` — per-generation save container entry point.
- `src/formats/shared/` — cross-generation logic (list packing, stat
  formulas, item lists, BCD money).
- `src/ui/tabs/ItemsTab.tsx` — has the known Gen IV item-whitelist gap.
- `.github/workflows/deploy-pages.yml` — Pages deploy, pending repo setting.
- `scripts/genN-roundtrip-test.mjs` — round-trip test, run via `npm run test:genN`.
