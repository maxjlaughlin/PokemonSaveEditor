import type { EditablePokemon, Stats } from '../../core/types';
import { decodeGen4Text, encodeGen4Text } from './text';
import { decryptGen4, encryptGen4, gen4PokemonChecksum } from './encryption';
import { GEN4_BASE_STATS } from '../../data/baseStatsGen4';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { calcModernStat, natureMod } from '../shared/modernStats';
import { SIZE_4PARTY, SIZE_4STORED } from './constants';

function readU16LE(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8); }
function writeU16LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; }
function readU32LE(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function writeU32LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; }

function packMetInfo(sid: number, pokerus: number, otGender: number, metLevel: number): number {
  return ((sid & 0xffff) << 16) | ((pokerus & 0xff) << 8) | ((otGender & 1) << 7) | (metLevel & 0x7f);
}
function unpackMetInfo(metInfo: number) {
  return { sid: (metInfo >>> 16) & 0xffff, pokerus: (metInfo >>> 8) & 0xff, otGender: (metInfo >>> 7) & 1, metLevel: metInfo & 0x7f };
}

const GENDER_CODE: Record<'M' | 'F' | 'U', number> = { M: 0, F: 1, U: 2 };
const GENDER_FROM_CODE: ('M' | 'F' | 'U')[] = ['M', 'F', 'U'];

export const emptyGen4Pokemon = (): EditablePokemon => ({
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
  abilityEditable: true,
  gender: 'U',
  genderEditable: true,
  isShiny: false,
  shinyEditable: false,
  friendship: 0,
  levelEditable: true,
  pokerus: 0,
  metInfo: 0,
  pid: 0,
});

/** Reads one Gen4 Pokemon from its raw (encrypted) 136 or 236 byte slot. Does not mutate the input. */
export function readGen4Pokemon(raw: Uint8Array): EditablePokemon {
  const pid = readU32LE(raw, 0);
  const { logical, partyStats } = decryptGen4(raw);
  const speciesId = readU16LE(logical, 0);
  if (speciesId === 0) return emptyGen4Pokemon();

  const heldItem = readU16LE(logical, 2);
  const tid = readU16LE(logical, 4);
  const sid = readU16LE(logical, 6);
  const exp = readU32LE(logical, 8);
  const friendship = logical[0x14 - 8];
  const ability = logical[0x15 - 8];
  const evs: Stats = {
    hp: logical[0x18 - 8], atk: logical[0x19 - 8], def: logical[0x1a - 8],
    spe: logical[0x1b - 8], spa: logical[0x1c - 8], spd: logical[0x1d - 8],
  };

  const bOff = 0x28 - 8;
  const moves: [number, number, number, number] = [
    readU16LE(logical, bOff), readU16LE(logical, bOff + 2), readU16LE(logical, bOff + 4), readU16LE(logical, bOff + 6),
  ];
  const movePp: [number, number, number, number] = [logical[bOff + 8], logical[bOff + 9], logical[bOff + 10], logical[bOff + 11]];
  const ppUps: [number, number, number, number] = [logical[bOff + 12], logical[bOff + 13], logical[bOff + 14], logical[bOff + 15]];
  const iv32 = readU32LE(logical, bOff + 16);
  const ivs: Stats = {
    hp: iv32 & 0x1f, atk: (iv32 >>> 5) & 0x1f, def: (iv32 >>> 10) & 0x1f,
    spe: (iv32 >>> 15) & 0x1f, spa: (iv32 >>> 20) & 0x1f, spd: (iv32 >>> 25) & 0x1f,
  };

  const cOff = 0x48 - 8;
  const nickname = decodeGen4Text(logical.subarray(cOff, cOff + 20));
  const genderBits = (logical[0x40 - 8] >> 1) & 3;

  const dOff = 0x68 - 8;
  const otName = decodeGen4Text(logical.subarray(dOff, dOff + 16));
  const pokerus = logical[0x82 - 8];
  const metByte = logical[0x84 - 8];
  const metLevel = metByte & 0x7f;
  const otGender = (metByte >> 7) & 1;

  const isParty = raw.length >= SIZE_4PARTY && partyStats !== null;
  let level = metLevel;
  let currentHp = 0;
  let status = 0;
  if (isParty && partyStats) {
    status = readU32LE(partyStats, 0x88 - SIZE_4STORED);
    level = partyStats[0x8c - SIZE_4STORED];
    currentHp = readU16LE(partyStats, 0x8e - SIZE_4STORED);
  }

  // Gen4 stores gender directly as bits in the Pokemon data (unlike Gen2/3 which derive it from
  // IV/PID), so we trust the stored value rather than recomputing from the species' gender ratio.
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
    nature: pid % 25,
    natureSupported: true,
    natureEditable: false,
    ability,
    abilitySupported: true,
    abilityEditable: true,
    gender: GENDER_FROM_CODE[genderBits] ?? 'U',
    genderEditable: true,
    isShiny: (((tid ^ sid ^ (pid & 0xffff) ^ (pid >>> 16)) & 0xffff) < 8),
    shinyEditable: false,
    friendship,
    levelEditable: isParty,
    pokerus,
    metInfo: packMetInfo(sid, pokerus, otGender, metLevel),
    pid,
  };
}

/** Writes a Gen4 Pokemon into a pre-sized 136 (box) or 236 (party) byte buffer. */
export function writeGen4Pokemon(pokemon: EditablePokemon, raw: Uint8Array) {
  raw.fill(0);
  if (pokemon.isEmpty || pokemon.speciesId === 0) return;

  const pid = (pokemon.pid || generatePid()) >>> 0;
  const { sid, pokerus, otGender, metLevel } = unpackMetInfo(pokemon.metInfo);

  const logical = new Uint8Array(128);
  writeU16LE(logical, 0, pokemon.speciesId);
  writeU16LE(logical, 2, pokemon.item);
  writeU16LE(logical, 4, pokemon.otId & 0xffff);
  writeU16LE(logical, 6, sid);
  writeU32LE(logical, 8, pokemon.exp);
  logical[0x14 - 8] = pokemon.friendship;
  logical[0x15 - 8] = pokemon.ability;
  logical[0x17 - 8] = 2; // language: English
  logical[0x18 - 8] = pokemon.evs.hp;
  logical[0x19 - 8] = pokemon.evs.atk;
  logical[0x1a - 8] = pokemon.evs.def;
  logical[0x1b - 8] = pokemon.evs.spe;
  logical[0x1c - 8] = pokemon.evs.spa;
  logical[0x1d - 8] = pokemon.evs.spd;

  const bOff = 0x28 - 8;
  writeU16LE(logical, bOff, pokemon.moves[0]);
  writeU16LE(logical, bOff + 2, pokemon.moves[1]);
  writeU16LE(logical, bOff + 4, pokemon.moves[2]);
  writeU16LE(logical, bOff + 6, pokemon.moves[3]);
  logical[bOff + 8] = pokemon.movePp[0];
  logical[bOff + 9] = pokemon.movePp[1];
  logical[bOff + 10] = pokemon.movePp[2];
  logical[bOff + 11] = pokemon.movePp[3];
  logical[bOff + 12] = pokemon.ppUps[0];
  logical[bOff + 13] = pokemon.ppUps[1];
  logical[bOff + 14] = pokemon.ppUps[2];
  logical[bOff + 15] = pokemon.ppUps[3];
  const iv32 = ((pokemon.ivs.hp & 0x1f) | ((pokemon.ivs.atk & 0x1f) << 5) | ((pokemon.ivs.def & 0x1f) << 10) |
    ((pokemon.ivs.spe & 0x1f) << 15) | ((pokemon.ivs.spa & 0x1f) << 20) | ((pokemon.ivs.spd & 0x1f) << 25)) >>> 0;
  writeU32LE(logical, bOff + 16, iv32);

  const cOff = 0x48 - 8;
  logical.set(encodeGen4Text(pokemon.nickname || defaultNickname(pokemon.speciesId), 10), cOff);
  logical[0x40 - 8] = (logical[0x40 - 8] & ~0x06) | ((GENDER_CODE[pokemon.gender] & 3) << 1);

  const dOff = 0x68 - 8;
  logical.set(encodeGen4Text(pokemon.otName, 7), dOff);
  logical[0x82 - 8] = pokerus;
  logical[0x84 - 8] = ((otGender & 1) << 7) | (metLevel & 0x7f);

  const checksum = gen4PokemonChecksum(logical);

  let partyStats: Uint8Array | null = null;
  const base = GEN4_BASE_STATS[pokemon.speciesId] ?? GEN4_BASE_STATS[0];
  const [baseHp, baseAtk, baseDef, baseSpe, baseSpa, baseSpd] = base;
  if (raw.length >= SIZE_4PARTY) {
    partyStats = new Uint8Array(SIZE_4PARTY - SIZE_4STORED);
    const nature = pid % 25;
    writeU32LE(partyStats, 0x88 - SIZE_4STORED, pokemon.status);
    partyStats[0x8c - SIZE_4STORED] = pokemon.level;
    const maxHp = calcModernStat(baseHp, pokemon.ivs.hp, pokemon.evs.hp, pokemon.level, true);
    const currentHp = pokemon.currentHp > 0 ? Math.min(pokemon.currentHp, maxHp) : maxHp;
    writeU16LE(partyStats, 0x8e - SIZE_4STORED, currentHp);
    writeU16LE(partyStats, 0x90 - SIZE_4STORED, maxHp);
    writeU16LE(partyStats, 0x92 - SIZE_4STORED, calcModernStat(baseAtk, pokemon.ivs.atk, pokemon.evs.atk, pokemon.level, false, natureMod(nature, 0)));
    writeU16LE(partyStats, 0x94 - SIZE_4STORED, calcModernStat(baseDef, pokemon.ivs.def, pokemon.evs.def, pokemon.level, false, natureMod(nature, 1)));
    writeU16LE(partyStats, 0x96 - SIZE_4STORED, calcModernStat(baseSpe, pokemon.ivs.spe, pokemon.evs.spe, pokemon.level, false, natureMod(nature, 2)));
    writeU16LE(partyStats, 0x98 - SIZE_4STORED, calcModernStat(baseSpa, pokemon.ivs.spa, pokemon.evs.spa, pokemon.level, false, natureMod(nature, 3)));
    writeU16LE(partyStats, 0x9a - SIZE_4STORED, calcModernStat(baseSpd, pokemon.ivs.spd, pokemon.evs.spd, pokemon.level, false, natureMod(nature, 4)));
  }

  const encrypted = encryptGen4(pid, checksum, logical, partyStats, raw.length);
  raw.set(encrypted);
}

function generatePid(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

function defaultNickname(speciesId: number): string {
  return (SPECIES_NAMES[speciesId] ?? '').toUpperCase();
}

export { SIZE_4STORED, SIZE_4PARTY };
