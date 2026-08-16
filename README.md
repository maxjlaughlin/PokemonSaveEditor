# Pokémon Save Editor

A browser-based Pokémon save file editor. Runs entirely client-side — your save
file is read and written locally in the browser and is never uploaded anywhere.

## Status

| Generation | Games | Status |
| --- | --- | --- |
| I | Red / Blue / Yellow | ✅ Implemented (trainer info, party, boxes, items) |
| II | Gold / Silver / Crystal | Planned |
| III | Ruby / Sapphire / Emerald / FireRed / LeafGreen | Planned |
| IV | Diamond / Pearl / Platinum / HeartGold / SoulSilver | Planned |
| V | Black / White / Black 2 / White 2 | Planned |
| VI+ | 3DS / Switch titles | Not currently planned — these use console-specific encryption that makes them significantly higher risk to get wrong |

Event injection (setting the flags needed to trigger in-game events, not just
handing over an item) is planned as a follow-up once core editing is solid
across more generations.

## Development

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run test:gen1 # synthetic round-trip test for the Gen1 save format
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
