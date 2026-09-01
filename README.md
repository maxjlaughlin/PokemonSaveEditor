# Pokémon Save Editor

A browser-based Pokémon save file editor. Runs entirely client-side — your save
file is read and written locally in the browser and is never uploaded anywhere.

## Status

| Generation | Games | Status |
| --- | --- | --- |
| I | Red / Blue / Yellow | ✅ Implemented (trainer info, party, boxes, items) |
| II | Gold / Silver / Crystal | ✅ Implemented (trainer info, party, boxes, 5 item pouches, held items) |
| III | Ruby / Sapphire / Emerald / FireRed / LeafGreen | ✅ Implemented (trainer info, party, boxes, 6 item pockets, held items, editable shiny, nature/ability/gender display, event injection) |
| IV | Diamond / Pearl / Platinum / HeartGold / SoulSilver | ✅ Implemented (trainer info, party, boxes, 8 item pockets, held items, directly-editable ability/gender, editable shiny, nature display, event injection) |
| V | Black / White / Black 2 / White 2 | Planned |
| VI+ | 3DS / Switch titles | Not currently planned — these use console-specific encryption that makes them significantly higher risk to get wrong |

### Event injection (Gen III/IV)

The Events tab lets you inject real, historically-distributed in-game events
into a Gen III or Gen IV save: Mystery Gift-style Pokémon (movie/GameStop
distributions, Wonder Cards, e-Reader/bonus-disc gifts) with their documented
species/level/moveset/OT, and ticket/key-item-triggered location unlocks
(Eon Ticket → Southern Island, Member Card → Darkrai, etc.), which add the
real unlock item and leave the actual wild encounter to the game itself so
its moveset/IVs generate normally. Every entry's stats were verified against
real distributed save files and public references rather than worked from
memory — see `src/data/eventsGen3.ts` / `eventsGen4.ts` for sources, and
each event's in-app detail panel cites where its data came from. This is a
curated, well-documented subset, not literally every event ever distributed;
a few real items (Azure Flute) are deliberately excluded because research
turned up no evidence they were ever actually functional/distributed.

Some fields are derived from a Pokémon's Personality Value (PID, Gen III/IV)
or specific IVs (Gen II) rather than stored independently — Gen II gender,
Gen III nature/ability/gender, Gen IV nature (Gen IV *does* store ability and
gender directly, so those are editable). Derived fields are shown read-only
rather than edited directly. Shininess is the one derived field this editor
*can* edit (Gen II–IV) by regenerating the underlying PID/IVs while
preserving nature/gender — see the shiny checkbox in the Pokémon editor.
Gen III and Gen IV box-stored Pokémon also don't store level directly (only
Experience), so Level is shown as read-only for boxed (non-party) Pokémon in
those generations.

Gen IV item pockets are fixed-position (each pocket only accepts items from
a specific category, e.g. Berries can't go in the Key Items pocket) — the
item dropdown isn't filtered to valid choices yet, so picking an item that
doesn't belong in that pocket is silently ignored on export rather than
flagged in the UI.

## Getting it without building from source

- **Single HTML file**: download it from the live site (a link is on the
  import screen) or build it yourself with `npm run build:standalone` — the
  result (`dist-standalone/index.html`) is one self-contained file with
  everything inlined. Double-click it to open in your browser; no server,
  no install, works fully offline.
- **Desktop app (.exe / .app / .AppImage)**: pushing a `v*` tag (or running
  the "Build desktop app" workflow manually from the Actions tab) builds
  installers for Windows, macOS, and Linux via GitHub Actions and attaches
  them to a GitHub Release. These aren't code-signed (that costs money and
  isn't worth it for a small open-source tool), so Windows SmartScreen and
  macOS Gatekeeper will warn on first run — on Windows click "More info" →
  "Run anyway"; on macOS right-click the app → "Open" (or run
  `xattr -cr /Applications/Pokémon\ Save\ Editor.app` once). The desktop app
  is just the standalone HTML build wrapped in an Electron window — same
  code, same safety properties (nothing leaves your machine).

## Development

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run test:gen1 # synthetic round-trip test for the Gen1 save format
npm run test:gen2 # synthetic round-trip test for the Gen2 save format
npm run test:gen3 # synthetic round-trip test for the Gen3 save format
npm run test:gen4 # synthetic round-trip test for the Gen4 save format
npm run test:events # round-trip test for event injection (PID gen, Exp curve, item grants)
npm run build:standalone # single self-contained HTML file (dist-standalone/index.html)
npm run dist:mac / dist:win / dist:linux # desktop app installer for the current OS (needs Electron's binary download)
```

## Architecture

- `src/core/` — generation-agnostic types and the format-detection registry.
- `src/formats/genN/` — one module per generation, each implementing the
  `SaveFormatModule` interface (`detect` + `load`) and producing a `SaveFile`
  (`toBytes()` re-serializes edits back into a valid save, recomputing all
  checksums).
- `src/data/` — name tables (species/moves/items) and base stat tables.
- `src/ui/` — the React editor UI, generic across generations via
  `SaveFile.capabilities`.

Save format byte offsets and algorithms were cross-checked against multiple
independent public sources before implementation, and each generation module
has a round-trip test (import → edit → export → re-import) verifying data
survives unchanged and checksums stay valid.

## Safety

Always keep a backup of your original save file before editing it here.
