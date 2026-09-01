import type { EditablePokemon, ItemPouch, SaveFile } from '../../core/types';
import type { EventDefinition, EventPokemonSpec } from '../../core/events';
import { generateEventPid } from './eventPid';
import { expForLevel } from './expCurve';
import { GEN3_BASE_STATS } from '../../data/baseStatsGen3';
import { GEN4_BASE_STATS } from '../../data/baseStatsGen4';
import { getItemNames } from '../../data/itemNames';
import { GEN4_KEY_DP, GEN4_KEY_HGSS, GEN4_KEY_PT } from '../../data/itemPocketsGen4';

export interface ApplyEventResult {
  addedPokemon: string[];
  addedItems: string[];
  warnings: string[];
}

function gen4KeyWhitelist(versionTag: string | undefined): readonly number[] {
  if (versionTag === 'DP') return GEN4_KEY_DP;
  if (versionTag === 'Pt') return GEN4_KEY_PT;
  if (versionTag === 'HGSS') return GEN4_KEY_HGSS;
  return [];
}

/** Builds a fresh event Pokemon from its documented distribution stats. Nature/gender/shininess
 *  come from a freshly-generated PID matching the distribution's constraints (see eventPid.ts);
 *  ability defaults to the species' first ability slot, since neither Gen3 nor Gen4 distributions
 *  had Hidden Abilities to worry about (introduced in Gen5). */
function buildEventPokemon(save: SaveFile, spec: EventPokemonSpec): EditablePokemon {
  const empty = save.createEmptyPokemon();
  const tid = spec.otId & 0xffff;
  const sid = spec.otSid ?? 0;
  const pid = generateEventPid(tid, sid, { shiny: spec.shiny ?? false, nature: spec.nature });

  const base = save.generation === 4
    ? GEN4_BASE_STATS[spec.speciesId] ?? GEN4_BASE_STATS[0]
    : GEN3_BASE_STATS[spec.speciesId] ?? GEN3_BASE_STATS[0];
  const ability1 = base[9];

  const metInfo = save.generation === 4
    ? (((sid & 0xffff) << 16) | (0 << 8) | (0 << 7) | (spec.level & 0x7f))
    : (((sid & 0xffff) << 16) | (0 << 8) | (spec.level & 0x7f));

  return {
    ...empty,
    isEmpty: false,
    speciesId: spec.speciesId,
    nickname: spec.nickname ?? '',
    level: spec.level,
    currentHp: 0,
    status: 0,
    moves: spec.moves,
    movePp: [20, 20, 20, 20],
    ppUps: [0, 0, 0, 0],
    otName: spec.otName,
    otId: tid,
    exp: expForLevel(spec.growthRate, spec.level),
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: {
      hp: spec.ivs?.hp ?? 31, atk: spec.ivs?.atk ?? 31, def: spec.ivs?.def ?? 31,
      spa: spec.ivs?.spa ?? 31, spd: spec.ivs?.spd ?? 31, spe: spec.ivs?.spe ?? 31,
    },
    item: spec.heldItem ?? 0,
    nature: pid % 25,
    ability: ability1,
    gender: spec.gender ?? empty.gender,
    isShiny: spec.shiny ?? false,
    friendship: spec.friendship ?? 70,
    pokerus: 0,
    metInfo,
    pid,
    fatefulEncounter: save.generation === 4 ? (spec.fatefulEncounter ?? true) : undefined,
  };
}

function firstEmptySlot(save: SaveFile): ((mon: EditablePokemon) => void) | null {
  const partyIdx = save.party.findIndex((p) => p.isEmpty);
  if (partyIdx !== -1) return (mon) => { save.party[partyIdx] = mon; };
  for (const box of save.boxes) {
    const boxIdx = box.pokemon.findIndex((p) => p.isEmpty);
    if (boxIdx !== -1) return (mon) => { box.pokemon[boxIdx] = mon; };
  }
  return null;
}

function grantItem(pouches: ItemPouch[], itemId: number, quantity: number): string | null {
  const pouch = pouches.find((p) => p.name === 'Key Items') ?? pouches[0];
  const existing = pouch.items.find((i) => i.item === itemId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 99);
    return null;
  }
  if (pouch.items.length >= pouch.capacity) {
    return `${pouch.name} pocket is full - couldn't add the item.`;
  }
  pouch.items.push({ item: itemId, quantity });
  return null;
}

/** Applies an event definition to a save in place: grants its key item(s) and/or writes its
 *  Pokemon into the first empty party slot (falling back to the first empty box slot). Mutates
 *  `save` directly, matching how every other tab in this editor works - call `touch()` after. */
export function applyEvent(save: SaveFile, event: EventDefinition): ApplyEventResult {
  const result: ApplyEventResult = { addedPokemon: [], addedItems: [], warnings: [] };
  const itemNames = getItemNames(save.generation);

  for (const grant of event.items ?? []) {
    const itemId = itemNames.indexOf(grant.itemName);
    if (itemId <= 0) {
      result.warnings.push(`Unknown item "${grant.itemName}" for this generation - skipped.`);
      continue;
    }
    if (save.generation === 4) {
      const whitelist = gen4KeyWhitelist(save.versionTag);
      if (!whitelist.includes(itemId)) {
        result.warnings.push(`${grant.itemName} isn't a valid Key Item in this game version - skipped.`);
        continue;
      }
    }
    const warning = grantItem(save.itemPouches, itemId, grant.quantity ?? 1);
    if (warning) result.warnings.push(warning);
    else result.addedItems.push(grant.itemName);
  }

  for (const spec of event.pokemon ?? []) {
    const place = firstEmptySlot(save);
    if (!place) {
      result.warnings.push('No empty party or box slot available - some Pokémon could not be added.');
      break;
    }
    const mon = buildEventPokemon(save, spec);
    place(mon);
    result.addedPokemon.push(spec.nickname || mon.nickname || `Pokémon #${spec.speciesId}`);
  }

  return result;
}
