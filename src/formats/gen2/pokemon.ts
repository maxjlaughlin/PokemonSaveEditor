import type { EditablePokemon, Stats } from '../../core/types';
import { decodeGen1Text, encodeGen1Text } from '../gen1/text';
import { GEN2_BASE_STATS } from '../../data/baseStatsGen2';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { calcDvStat, packDvs, unpackDvs, hpDvFrom, genderFromAtkDv, isShinyGen2 } from '../shared/dvStats';
import { SIZE_PARTY, STRING_BUFFER_LENGTH } from './constants';

function readU16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function writeU16BE(b: Uint8Array, o: number, v: number) {
  b[o] = (v >> 8) & 0xff;
  b[o + 1] = v & 0xff;
}

export const emptyGen2Pokemon = (): EditablePokemon => ({
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
  natureSupported: false,
  natureEditable: false,
  ability: 0,
  abilitySupported: false,
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

/** Reads one Gen2 Pokemon from its body bytes (32 or 48 bytes) plus OT/nickname string buffers. */
export function readGen2Pokemon(body: Uint8Array, ot: Uint8Array, nickname: Uint8Array): EditablePokemon {
  const speciesId = body[0];
  if (speciesId === 0) return emptyGen2Pokemon();

  const heldItem = body[1];
  const moves: [number, number, number, number] = [body[2], body[3], body[4], body[5]];
  const otId = readU16BE(body, 0x06);
  const exp = (body[0x08] << 16) | (body[0x09] << 8) | body[0x0a];
  const evHp = readU16BE(body, 0x0b);
  const evAtk = readU16BE(body, 0x0d);
  const evDef = readU16BE(body, 0x0f);
  const evSpe = readU16BE(body, 0x11);
  const evSpc = readU16BE(body, 0x13);
  const dv = unpackDvs(body[0x15], body[0x16]);
  const hpDv = hpDvFrom(dv.atk, dv.def, dv.spe, dv.spc);
  const movePp: [number, number, number, number] = [body[0x17] & 0x3f, body[0x18] & 0x3f, body[0x19] & 0x3f, body[0x1a] & 0x3f];
  const ppUps: [number, number, number, number] = [(body[0x17] >> 6) & 3, (body[0x18] >> 6) & 3, (body[0x19] >> 6) & 3, (body[0x1a] >> 6) & 3];
  const friendship = body[0x1b];
  const pokerus = body[0x1c];
  const metInfo = readU16BE(body, 0x1d);
  const level = body[0x1f];

  const isParty = body.length >= SIZE_PARTY;
  const status = isParty ? body[0x20] : 0;
  const currentHp = isParty ? readU16BE(body, 0x22) : 0;

  const ivs: Stats = { hp: hpDv, atk: dv.atk, def: dv.def, spa: dv.spc, spd: dv.spc, spe: dv.spe };
  const evs: Stats = { hp: evHp, atk: evAtk, def: evDef, spa: evSpc, spd: evSpc, spe: evSpe };

  const genderRatio = GEN2_BASE_STATS[speciesId]?.[12] ?? 255;

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
    item: heldItem,
    heldItemSupported: true,
    nature: 0,
    natureSupported: false,
  natureEditable: false,
    ability: 0,
    abilitySupported: false,
  abilityEditable: false,
    gender: genderFromAtkDv(genderRatio, dv.atk),
    genderEditable: false,
    isShiny: isShinyGen2(dv.atk, dv.def, dv.spe, dv.spc),
    shinyEditable: false,
    friendship,
    levelEditable: true,
    pokerus,
    metInfo,
    pid: 0,
  };
}

/**
 * Writes a Gen2 Pokemon to body/ot/nickname buffers. `body` must be pre-sized to 32 (box) or 48 (party) bytes.
 * Recomputes derived party stats from base stats + IV + EV + level, same rationale as Gen1.
 */
export function writeGen2Pokemon(pokemon: EditablePokemon, body: Uint8Array, ot: Uint8Array, nickname: Uint8Array) {
  body.fill(0);
  if (pokemon.isEmpty || pokemon.speciesId === 0) {
    ot.fill(0x50);
    nickname.fill(0x50);
    return;
  }
  const base = GEN2_BASE_STATS[pokemon.speciesId] ?? GEN2_BASE_STATS[0];
  const [baseHp, baseAtk, baseDef, baseSpe, baseSpa, baseSpd] = base;

  body[0x00] = pokemon.speciesId;
  body[0x01] = pokemon.item;
  body[0x02] = pokemon.moves[0];
  body[0x03] = pokemon.moves[1];
  body[0x04] = pokemon.moves[2];
  body[0x05] = pokemon.moves[3];
  writeU16BE(body, 0x06, pokemon.otId & 0xffff);
  body[0x08] = (pokemon.exp >> 16) & 0xff;
  body[0x09] = (pokemon.exp >> 8) & 0xff;
  body[0x0a] = pokemon.exp & 0xff;
  writeU16BE(body, 0x0b, pokemon.evs.hp);
  writeU16BE(body, 0x0d, pokemon.evs.atk);
  writeU16BE(body, 0x0f, pokemon.evs.def);
  writeU16BE(body, 0x11, pokemon.evs.spe);
  writeU16BE(body, 0x13, pokemon.evs.spa); // Special EV (spa/spd mirrored in Gen2)

  const [dv0, dv1] = packDvs(pokemon.ivs.atk, pokemon.ivs.def, pokemon.ivs.spe, pokemon.ivs.spa);
  body[0x15] = dv0;
  body[0x16] = dv1;

  for (let i = 0; i < 4; i++) {
    body[0x17 + i] = (pokemon.movePp[i] & 0x3f) | ((pokemon.ppUps[i] & 3) << 6);
  }

  body[0x1b] = pokemon.friendship;
  body[0x1c] = pokemon.pokerus;
  writeU16BE(body, 0x1d, pokemon.metInfo);
  body[0x1f] = pokemon.level;

  if (body.length >= SIZE_PARTY) {
    body[0x20] = pokemon.status;
    const hpDv = hpDvFrom(pokemon.ivs.atk, pokemon.ivs.def, pokemon.ivs.spe, pokemon.ivs.spa);
    const maxHp = calcDvStat(baseHp, hpDv, pokemon.evs.hp, pokemon.level, true);
    const currentHp = pokemon.currentHp > 0 ? Math.min(pokemon.currentHp, maxHp) : maxHp;
    writeU16BE(body, 0x22, currentHp);
    writeU16BE(body, 0x24, maxHp);
    writeU16BE(body, 0x26, calcDvStat(baseAtk, pokemon.ivs.atk, pokemon.evs.atk, pokemon.level, false));
    writeU16BE(body, 0x28, calcDvStat(baseDef, pokemon.ivs.def, pokemon.evs.def, pokemon.level, false));
    writeU16BE(body, 0x2a, calcDvStat(baseSpe, pokemon.ivs.spe, pokemon.evs.spe, pokemon.level, false));
    writeU16BE(body, 0x2c, calcDvStat(baseSpa, pokemon.ivs.spa, pokemon.evs.spa, pokemon.level, false));
    writeU16BE(body, 0x2e, calcDvStat(baseSpd, pokemon.ivs.spd, pokemon.evs.spd, pokemon.level, false));
  }

  ot.set(encodeGen1Text(pokemon.otName, Math.min(ot.length, STRING_BUFFER_LENGTH)));
  nickname.set(encodeGen1Text(pokemon.nickname || defaultNickname(pokemon.speciesId), Math.min(nickname.length, STRING_BUFFER_LENGTH)));
}

function defaultNickname(speciesId: number): string {
  return (SPECIES_NAMES[speciesId] ?? '').toUpperCase();
}
