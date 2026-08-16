# Pokémon Save Editor

A browser-based Pokémon save file editor. Runs entirely client-side — your save
file is read and written locally in the browser and is never uploaded anywhere.

## Status

| Generation | Games | Status |
| --- | --- | --- |
| I | Red / Blue / Yellow | ✅ Implemented (trainer info, party, boxes, items) |
| II | Gold / Silver / Crystal | ✅ Implemented (trainer info, party, boxes, 5 item pouches, held items) |
| III | Ruby / Sapphire / Emerald / FireRed / LeafGreen | ✅ Implemented (trainer info, party, boxes, 6 item pockets, held items, nature/ability/gender/shiny display) |
| IV | Diamond / Pearl / Platinum / HeartGold / SoulSilver | ✅ Implemented (trainer info, party, boxes, 8 item pockets, held items, directly-editable ability/gender, nature/shiny display) |
| V | Black / White / Black 2 / White 2 | Planned |
| VI+ | 3DS / Switch titles | Not currently planned — these use console-specific encryption that makes them significantly higher risk to get wrong |

Event injection (setting the flags needed to trigger in-game events, not just
handing over an item) is planned as a follow-up once core editing is solid
across more generations.

Some fields are derived from a Pokémon's Personality Value (PID) rather than
stored independently — Gen II gender/shininess, Gen III nature/ability/
gender/shininess, Gen IV nature/shininess (Gen IV *does* store ability and
gender directly, so those are editable). Derived fields are shown read-only
rather than edited directly, since "editing" them really means regenerating
the PID, which this editor doesn't do yet. Gen III and Gen IV box-stored
Pokémon also don't store level directly (only Experience), so Level is shown
as read-only for boxed (non-party) Pokémon in those generations.

Gen IV item pockets are fixed-position (each pocket only accepts items from
a specific category, e.g. Berries can't go in the Key Items pocket) — the
item dropdown isn't filtered to valid choices yet, so picking an item that
doesn't belong in that pocket is silently ignored on export rather than
flagged in the UI.

## Development

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run test:gen1 # synthetic round-trip test for the Gen1 save format
npm run test:gen2 # synthetic round-trip test for the Gen2 save format
npm run test:gen3 # synthetic round-trip test for the Gen3 save format
npm run test:gen4 # synthetic round-trip test for the Gen4 save format
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
