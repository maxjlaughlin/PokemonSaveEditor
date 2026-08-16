import type { EditablePokemon, Stats } from '../../core/types';
import { decodeGen3Text, encodeGen3Text } from './text';
import { decryptGen3Substructures, encryptGen3Substructures, gen3PokemonChecksum } from './encryption';
import { GEN3_INTERNAL_TO_NATIONAL, GEN3_NATIONAL_TO_INTERNAL } from '../../data/gen3SpeciesMap';
import { GEN3_BASE_STATS } from '../../data/baseStatsGen3';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { SIZE_3PARTY, SIZE_3STORED } from './constants';

function readU16LE(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8); }
function writeU16LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; }
function readU32LE(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function writeU32LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; }

/** Nature modifier for stat index 0=Atk,1=Def,2=Spe,3=SpA,4=SpD. */
function natureMod(nature: number, statIndex: number): number {
  const row = Math.floor(nature / 5);
  const col = nature % 5;
  if (row === col) return 1;
  if (statIndex === row) return 1.1;
  if (statIndex === col) return 0.9;
  return 1;
}

function calcStat(base: number, iv: number, ev: number, level: number, isHp: boolean, mod = 1): number {
  const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
  return isHp ? core + level + 10 : Math.floor((core + 5) * mod);
}

function genderFromPid(genderRatio: number, pid: number): 'M' | 'F' | 'U' {
  if (genderRatio === 255) return 'U';
  if (genderRatio === 0) return 'M';
  if (genderRatio === 254) return 'F';
  return (pid & 0xff) < genderRatio ? 'F' : 'M';
}

/** metInfo bundles fields Gen3 needs but this editor doesn't surface directly: secret ID (16b),
 *  met location (8b), met level (7b) - packed so they round-trip untouched through edits. */
function packMetInfo(sid: number, metLocation: number, metLevel: number): number {
  return ((sid & 0xffff) << 16) | ((metLocation & 0xff) << 8) | (metLevel & 0x7f);
}
function unpackMetInfo(metInfo: number) {
  return { sid: (metInfo >>> 16) & 0xffff, metLocation: (metInfo >>> 8) & 0xff, metLevel: metInfo & 0x7f };
}

export const emptyGen3Pokemon = (): EditablePokemon => ({
  isEmpty: true,
  speciesId: 0,
  nickname: '',
  level: 0,
  currentHp: 0,
  status: 0,
  moves: [0, 0, 0, 0],
  movePp: [0, 0, 0, 0],
  ppUps: [0, 0, 0, 0],
  otName: '',
  otId: 0,
  exp: 0,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  item: 0,
  heldItemSupported: true,
  nature: 0,
  natureSupported: true,
  natureEditable: false,
  ability: 0,
  abilitySupported: true,
  abilityEditable: false,
  gender: 'U',
  genderEditable: false,
  isShiny: false,
  shinyEditable: false,
  friendship: 0,
  levelEditable: true,
  pokerus: 0,
  metInfo: 0,
  pid: 0,
});

/** Reads one Gen3 Pokemon from its raw (encrypted) 80 or 100 byte slot. Does not mutate the input. */
export function readGen3Pokemon(raw: Uint8Array): EditablePokemon {
  const pid = readU32LE(raw, 0x00);
  const hasSpecies = (raw[0x13] & 2) !== 0;
  if (!hasSpecies) return emptyGen3Pokemon();

  const otId = readU32LE(raw, 0x04);
  const tid = otId & 0xffff;
  const sid = (otId >>> 16) & 0xffff;
  const nickname = decodeGen3Text(raw.subarray(0x08, 0x12));
  const otName = decodeGen3Text(raw.subarray(0x14, 0x1b));

  const logical = decryptGen3Substructures(raw);
  const internalSpecies = readU16LE(logical, 0);
  if (internalSpecies === 0) return emptyGen3Pokemon();

  const heldItem = readU16LE(logical, 2);
  const exp = readU32LE(logical, 4);
  const ppUpsPacked = logical[8];
  const friendship = logical[9];
  const ppUps: [number, number, number, number] = [ppUpsPacked & 3, (ppUpsPacked >> 2) & 3, (ppUpsPacked >> 4) & 3, (ppUpsPacked >> 6) & 3];

  const bOff = 12;
  const moves: [number, number, number, number] = [
    readU16LE(logical, bOff + 0), readU16LE(logical, bOff + 2), readU16LE(logical, bOff + 4), readU16LE(logical, bOff + 6),
  ];
  const movePp: [number, number, number, number] = [logical[bOff + 8], logical[bOff + 9], logical[bOff + 10], logical[bOff + 11]];

  const cOff = 24;
  const evs: Stats = {
    hp: logical[cOff + 0], atk: logical[cOff + 1], def: logical[cOff + 2],
    spe: logical[cOff + 3], spa: logical[cOff + 4], spd: logical[cOff + 5],
  };

  const dOff = 36;
  const pokerus = logical[dOff + 0];
  const metLocation = logical[dOff + 1];
  const origins = readU16LE(logical, dOff + 2);
  const metLevel = origins & 0x7f;
  const iv32 = readU32LE(logical, dOff + 4);
  const ivs: Stats = {
    hp: iv32 & 0x1f, atk: (iv32 >>> 5) & 0x1f, def: (iv32 >>> 10) & 0x1f,
    spe: (iv32 >>> 15) & 0x1f, spa: (iv32 >>> 20) & 0x1f, spd: (iv32 >>> 25) & 0x1f,
  };
  const abilityBit = (iv32 >>> 31) & 1;

  const speciesId = GEN3_INTERNAL_TO_NATIONAL[internalSpecies] ?? 0;
  const base = GEN3_BASE_STATS[speciesId] ?? GEN3_BASE_STATS[0];
  const [, , , , , , , , genderRatio, ability1, ability2] = base;
  const ability = abilityBit === 1 && ability2 !== ability1 ? ability2 : ability1;
  const nature = pid % 25;
  const shiny = ((tid ^ sid ^ (pid & 0xffff) ^ (pid >>> 16)) & 0xffff) < 8;

  const isParty = raw.length >= SIZE_3PARTY;
  let level = metLevel;
  let currentHp = 0;
  let status = 0;
  if (isParty) {
    status = readU32LE(raw, 0x50);
    level = raw[0x54];
    currentHp = readU16LE(raw, 0x56);
  }

  return {
    isEmpty: false,
    speciesId,
    nickname,
    level,
    currentHp,
    status,
    moves,
    movePp,
    ppUps,
    otName,
    otId: tid,
    exp,
    evs,
    ivs,
    item: heldItem,
    heldItemSupported: true,
    nature,
    natureSupported: true,
    natureEditable: false,
    ability,
    abilitySupported: true,
    abilityEditable: false,
    gender: genderFromPid(genderRatio, pid),
    genderEditable: false,
    isShiny: shiny,
    shinyEditable: false,
    friendship,
    levelEditable: isParty,
    pokerus,
    metInfo: packMetInfo(sid, metLocation, metLevel),
    pid,
  };
}

/**
 * Writes a Gen3 Pokemon into a pre-sized 80 (box) or 100 (party) byte buffer. PID/secret ID are
 * preserved from the original Pokemon (nature/gender/shiny/ability all derive from PID and are not
 * independently editable in this editor - a fresh PID is generated only for brand-new additions).
 */
export function writeGen3Pokemon(pokemon: EditablePokemon, raw: Uint8Array) {
  raw.fill(0);
  if (pokemon.isEmpty || pokemon.speciesId === 0) return;

  const pid = (pokemon.pid || generatePid()) >>> 0;
  const { sid, metLocation, metLevel } = unpackMetInfo(pokemon.metInfo);
  const otId = ((sid << 16) | (pokemon.otId & 0xffff)) >>> 0;

  writeU32LE(raw, 0x00, pid);
  writeU32LE(raw, 0x04, otId);
  raw.set(encodeGen3Text(pokemon.nickname || defaultNickname(pokemon.speciesId), 10), 0x08);
  raw[0x12] = 2; // language: English
  raw[0x13] = 0b010; // FlagHasSpecies set, not egg
  raw.set(encodeGen3Text(pokemon.otName, 7), 0x14);
  raw[0x1b] = 0;

  const internalSpecies = GEN3_NATIONAL_TO_INTERNAL[pokemon.speciesId] ?? 0;
  const base = GEN3_BASE_STATS[pokemon.speciesId] ?? GEN3_BASE_STATS[0];
  const [baseHp, baseAtk, baseDef, baseSpe, baseSpa, baseSpd, , , , ability1, ability2] = base;

  const logical = new Uint8Array(48);
  writeU16LE(logical, 0, internalSpecies);
  writeU16LE(logical, 2, pokemon.item);
  writeU32LE(logical, 4, pokemon.exp);
  logical[8] = (pokemon.ppUps[0] & 3) | ((pokemon.ppUps[1] & 3) << 2) | ((pokemon.ppUps[2] & 3) << 4) | ((pokemon.ppUps[3] & 3) << 6);
  logical[9] = pokemon.friendship;

  const bOff = 12;
  writeU16LE(logical, bOff + 0, pokemon.moves[0]);
  writeU16LE(logical, bOff + 2, pokemon.moves[1]);
  writeU16LE(logical, bOff + 4, pokemon.moves[2]);
  writeU16LE(logical, bOff + 6, pokemon.moves[3]);
  logical[bOff + 8] = pokemon.movePp[0];
  logical[bOff + 9] = pokemon.movePp[1];
  logical[bOff + 10] = pokemon.movePp[2];
  logical[bOff + 11] = pokemon.movePp[3];

  const cOff = 24;
  logical[cOff + 0] = pokemon.evs.hp;
  logical[cOff + 1] = pokemon.evs.atk;
  logical[cOff + 2] = pokemon.evs.def;
  logical[cOff + 3] = pokemon.evs.spe;
  logical[cOff + 4] = pokemon.evs.spa;
  logical[cOff + 5] = pokemon.evs.spd;

  const dOff = 36;
  logical[dOff + 0] = pokemon.pokerus;
  logical[dOff + 1] = metLocation;
  const origins = (metLevel & 0x7f) | (3 << 7); // ball=3 (Poke Ball) as a reasonable default; version bits left 0
  writeU16LE(logical, dOff + 2, origins);
  const abilityBit = pokemon.ability === ability2 && ability2 !== ability1 ? 1 : 0;
  const iv32 = ((pokemon.ivs.hp & 0x1f) | ((pokemon.ivs.atk & 0x1f) << 5) | ((pokemon.ivs.def & 0x1f) << 10) |
    ((pokemon.ivs.spe & 0x1f) << 15) | ((pokemon.ivs.spa & 0x1f) << 20) | ((pokemon.ivs.spd & 0x1f) << 25) |
    (abilityBit << 31)) >>> 0;
  writeU32LE(logical, dOff + 4, iv32);

  const checksum = gen3PokemonChecksum(logical);
  writeU16LE(raw, 0x1c, checksum);

  const encrypted = encryptGen3Substructures(logical, pid, otId);
  raw.set(encrypted, 0x20);

  if (raw.length >= SIZE_3PARTY) {
    const nature = pid % 25;
    writeU32LE(raw, 0x50, pokemon.status);
    raw[0x54] = pokemon.level;
    const maxHp = calcStat(baseHp, pokemon.ivs.hp, pokemon.evs.hp, pokemon.level, true);
    const currentHp = pokemon.currentHp > 0 ? Math.min(pokemon.currentHp, maxHp) : maxHp;
    writeU16LE(raw, 0x56, currentHp);
    writeU16LE(raw, 0x58, maxHp);
    writeU16LE(raw, 0x5a, calcStat(baseAtk, pokemon.ivs.atk, pokemon.evs.atk, pokemon.level, false, natureMod(nature, 0)));
    writeU16LE(raw, 0x5c, calcStat(baseDef, pokemon.ivs.def, pokemon.evs.def, pokemon.level, false, natureMod(nature, 1)));
    writeU16LE(raw, 0x5e, calcStat(baseSpe, pokemon.ivs.spe, pokemon.evs.spe, pokemon.level, false, natureMod(nature, 2)));
    writeU16LE(raw, 0x60, calcStat(baseSpa, pokemon.ivs.spa, pokemon.evs.spa, pokemon.level, false, natureMod(nature, 3)));
    writeU16LE(raw, 0x62, calcStat(baseSpd, pokemon.ivs.spd, pokemon.evs.spd, pokemon.level, false, natureMod(nature, 4)));
  }
}

function generatePid(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

function defaultNickname(speciesId: number): string {
  return (SPECIES_NAMES[speciesId] ?? '').toUpperCase();
}

export { SIZE_3STORED, SIZE_3PARTY };
