import type { EditablePokemon, Stats } from '../../core/types';
import { decodeGen1Text, encodeGen1Text } from './text';
import { GEN1_INTERNAL_TO_NATIONAL, GEN1_NATIONAL_TO_INTERNAL } from '../../data/gen1SpeciesMap';
import { GEN1_BASE_STATS } from '../../data/baseStatsGen1';
import { MAX_STRING_LENGTH_NICKNAME, MAX_STRING_LENGTH_TRAINER, SIZE_PARTY, SIZE_STORED, STRING_BUFFER_LENGTH } from './constants';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { calcDvStat, packDvs, unpackDvs, hpDvFrom } from '../shared/dvStats';

function readU16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function writeU16BE(b: Uint8Array, o: number, v: number) {
  b[o] = (v >> 8) & 0xff;
  b[o + 1] = v & 0xff;
}

export const calcGen1Stat = calcDvStat;

export const emptyGen1Pokemon = (): EditablePokemon => ({
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
  heldItemSupported: false,
  nature: 0,
  natureSupported: false,
  natureEditable: false,
  ability: 0,
  abilitySupported: false,
  abilityEditable: false,
  gender: 'U',
  genderEditable: false,
  isShiny: false,
  shinySupported: false,
  shinyEditable: false,
  friendship: 0,
  levelEditable: true,
  pokerus: 0,
  metInfo: 0,
  pid: 0,
});

/** Reads one Gen1 Pokemon from its body bytes (33 or 44 bytes) plus OT/nickname string buffers. */
export function readGen1Pokemon(body: Uint8Array, ot: Uint8Array, nickname: Uint8Array): EditablePokemon {
  const internalSpecies = body[0];
  if (internalSpecies === 0) return emptyGen1Pokemon();

  const speciesId = GEN1_INTERNAL_TO_NATIONAL[internalSpecies] ?? 0;
  const currentHp = readU16BE(body, 0x01);
  const levelBox = body[0x03];
  const status = body[0x04];
  const moves: [number, number, number, number] = [body[0x08], body[0x09], body[0x0a], body[0x0b]];
  const otId = readU16BE(body, 0x0c);
  const exp = (body[0x0e] << 16) | (body[0x0f] << 8) | body[0x10];
  const evHp = readU16BE(body, 0x11);
  const evAtk = readU16BE(body, 0x13);
  const evDef = readU16BE(body, 0x15);
  const evSpe = readU16BE(body, 0x17);
  const evSpc = readU16BE(body, 0x19);
  const dv = unpackDvs(body[0x1b], body[0x1c]);
  const hpDv = hpDvFrom(dv.atk, dv.def, dv.spe, dv.spc);
  const movePp: [number, number, number, number] = [body[0x1d] & 0x3f, body[0x1e] & 0x3f, body[0x1f] & 0x3f, body[0x20] & 0x3f];
  const ppUps: [number, number, number, number] = [(body[0x1d] >> 6) & 3, (body[0x1e] >> 6) & 3, (body[0x1f] >> 6) & 3, (body[0x20] >> 6) & 3];

  const isParty = body.length >= SIZE_PARTY;
  const level = isParty ? body[0x21] : levelBox;

  const ivs: Stats = { hp: hpDv, atk: dv.atk, def: dv.def, spa: dv.spc, spd: dv.spc, spe: dv.spe };
  const evs: Stats = { hp: evHp, atk: evAtk, def: evDef, spa: evSpc, spd: evSpc, spe: evSpe };

  return {
    isEmpty: false,
    speciesId,
    nickname: decodeGen1Text(nickname),
    level,
    currentHp,
    status,
    moves,
    movePp,
    ppUps,
    otName: decodeGen1Text(ot),
    otId,
    exp,
    evs,
    ivs,
    item: 0,
    heldItemSupported: false,
    nature: 0,
    natureSupported: false,
  natureEditable: false,
    ability: 0,
    abilitySupported: false,
  abilityEditable: false,
    gender: 'U',
    genderEditable: false,
    isShiny: false,
    shinySupported: false,
    shinyEditable: false,
    friendship: 0,
    levelEditable: true,
    pokerus: 0,
    metInfo: 0,
    pid: 0,
  };
}

/**
 * Writes a Gen1 Pokemon to body/ot/nickname buffers. `body` must be pre-sized to 33 (box) or 44 (party) bytes.
 * Recomputes derived party stats (max HP / Atk / Def / Spe / Spc) from base stats + IV + EV + level so the
 * written save stays internally consistent (a save with stale stats after an edit can behave incorrectly in-game).
 */
export function writeGen1Pokemon(pokemon: EditablePokemon, body: Uint8Array, ot: Uint8Array, nickname: Uint8Array) {
  body.fill(0);
  if (pokemon.isEmpty || pokemon.speciesId === 0) {
    ot.fill(0x50);
    nickname.fill(0x50);
    return;
  }
  const internalSpecies = GEN1_NATIONAL_TO_INTERNAL[pokemon.speciesId] ?? 0;
  const base = GEN1_BASE_STATS[pokemon.speciesId] ?? GEN1_BASE_STATS[0];
  const [baseHp, baseAtk, baseDef, baseSpe, baseSpc, type1, type2, catchRate] = base;

  body[0x00] = internalSpecies;
  writeU16BE(body, 0x01, pokemon.currentHp);
  body[0x03] = pokemon.level;
  body[0x04] = pokemon.status;
  body[0x05] = type1;
  body[0x06] = type2;
  body[0x07] = catchRate;
  body[0x08] = pokemon.moves[0];
  body[0x09] = pokemon.moves[1];
  body[0x0a] = pokemon.moves[2];
  body[0x0b] = pokemon.moves[3];
  writeU16BE(body, 0x0c, pokemon.otId & 0xffff);
  body[0x0e] = (pokemon.exp >> 16) & 0xff;
  body[0x0f] = (pokemon.exp >> 8) & 0xff;
  body[0x10] = pokemon.exp & 0xff;
  writeU16BE(body, 0x11, pokemon.evs.hp);
  writeU16BE(body, 0x13, pokemon.evs.atk);
  writeU16BE(body, 0x15, pokemon.evs.def);
  writeU16BE(body, 0x17, pokemon.evs.spe);
  writeU16BE(body, 0x19, pokemon.evs.spa); // Special EV (spa/spd mirrored in Gen1)

  const [dv0, dv1] = packDvs(pokemon.ivs.atk, pokemon.ivs.def, pokemon.ivs.spe, pokemon.ivs.spa);
  body[0x1b] = dv0;
  body[0x1c] = dv1;

  for (let i = 0; i < 4; i++) {
    body[0x1d + i] = (pokemon.movePp[i] & 0x3f) | ((pokemon.ppUps[i] & 3) << 6);
  }

  if (body.length >= SIZE_PARTY) {
    body[0x21] = pokemon.level;
    // HP IV is not stored independently in Gen1/2: it's derived from the low bit of each other IV.
    const hpDv = hpDvFrom(pokemon.ivs.atk, pokemon.ivs.def, pokemon.ivs.spe, pokemon.ivs.spa);
    writeU16BE(body, 0x22, calcGen1Stat(baseHp, hpDv, pokemon.evs.hp, pokemon.level, true));
    writeU16BE(body, 0x24, calcGen1Stat(baseAtk, pokemon.ivs.atk, pokemon.evs.atk, pokemon.level, false));
    writeU16BE(body, 0x26, calcGen1Stat(baseDef, pokemon.ivs.def, pokemon.evs.def, pokemon.level, false));
    writeU16BE(body, 0x28, calcGen1Stat(baseSpe, pokemon.ivs.spe, pokemon.evs.spe, pokemon.level, false));
    writeU16BE(body, 0x2a, calcGen1Stat(baseSpc, pokemon.ivs.spa, pokemon.evs.spa, pokemon.level, false));
  }

  ot.set(encodeGen1Text(pokemon.otName, Math.min(ot.length, STRING_BUFFER_LENGTH)));
  nickname.set(encodeGen1Text(pokemon.nickname || defaultNickname(pokemon.speciesId), Math.min(nickname.length, STRING_BUFFER_LENGTH)));
}

function defaultNickname(speciesId: number): string {
  return (SPECIES_NAMES[speciesId] ?? '').toUpperCase();
}

export { SIZE_STORED, SIZE_PARTY, MAX_STRING_LENGTH_TRAINER, MAX_STRING_LENGTH_NICKNAME };
