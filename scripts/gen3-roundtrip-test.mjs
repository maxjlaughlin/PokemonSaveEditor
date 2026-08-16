// Synthetic round-trip validation for the Gen3 (Emerald) save module.
import { gen3Module } from '../src/formats/gen3/save.ts';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK:', msg);
}

const SIZE_SECTOR = 0x1000;
const SIZE_SECTOR_USED = 0xf80;
const SAVE_SIZE = 0x20000;

// Build a minimal synthetic Emerald save: slot 0 has all 14 sectors present with identity id mapping
// (physical sector i holds section id i), a nonzero save counter, and a security key that
// unambiguously identifies Emerald (nonzero, not 1).
const bytes = new Uint8Array(SAVE_SIZE);
const SECURITY_KEY = 0x12345678;

for (let i = 0; i < 14; i++) {
  const off = i * SIZE_SECTOR;
  bytes[off + 0xff4] = i & 0xff; // section id (low byte)
  bytes[off + 0xff5] = (i >> 8) & 0xff;
  // save counter (4 bytes LE) - consistent across all sectors, higher than slot 1's (all-zero -> 0)
  bytes[off + 0xffc] = 1;
}
// Emerald security key lives in the small block (section id 0) at offset 0xAC.
bytes[0xac] = SECURITY_KEY & 0xff;
bytes[0xad] = (SECURITY_KEY >> 8) & 0xff;
bytes[0xae] = (SECURITY_KEY >> 16) & 0xff;
bytes[0xaf] = (SECURITY_KEY >>> 24) & 0xff;

assert(gen3Module.detect(bytes), 'synthetic buffer passes structural detection');
const save = gen3Module.load(bytes);
assert(save.gameTitle === 'Pokémon Emerald', `identified as Emerald: ${save.gameTitle}`);
assert(save.party.length === 6, 'party has 6 slots');
assert(save.boxes.length === 14, '14 boxes');
assert(save.boxes[0].pokemon.length === 30, 'box has 30 slots');
assert(save.itemPouches.length === 6, '6 item pouches (Items/Key/Balls/TM-HM/Berries/PC)');

save.trainer.name = 'BRENDAN';
save.trainer.id = 40000;
save.trainer.money = 500000;
save.trainer.badges = 0b10101010;

// Slot 0: Blaziken (male-only species, ratio=OM=0) with specific IVs/nature-affecting PID.
// PID chosen so nature = PID%25 = 6 (Bold: boosts Def, lowers Atk), and shiny/gender don't matter here.
const pid = 6; // simplest PID satisfying %25 == 6 and %24 == 6 (shuffle order index 6)
save.party[0] = {
  ...save.party[0],
  isEmpty: false,
  speciesId: 257, // Blaziken
  nickname: 'BLAZIKEN',
  level: 50,
  currentHp: 140,
  status: 0,
  moves: [280, 53, 337, 116], // arbitrary valid-range move ids
  movePp: [20, 15, 10, 20],
  ppUps: [3, 0, 0, 1],
  otName: 'BRENDAN',
  otId: 40000,
  exp: 125000,
  evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 30, def: 31, spa: 15, spd: 20, spe: 25 },
  item: 258, // an arbitrary item id
  friendship: 120,
  pid,
  metInfo: (0 << 16) | (10 << 8) | 5, // sid=0, metLocation=10, metLevel=5
};

// Box 3 slot 0: Wailord in storage (box format, no level field stored)
save.boxes[2].pokemon[0] = {
  ...save.boxes[2].pokemon[0],
  isEmpty: false,
  speciesId: 321, // Wailord
  nickname: 'WAILORD',
  moves: [55, 57, 291, 240],
  movePp: [15, 10, 5, 15],
  ppUps: [0, 0, 0, 0],
  otName: 'BRENDAN',
  otId: 40000,
  exp: 900000,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 20, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 },
  item: 0,
  friendship: 70,
  pid: 12345,
  metInfo: (0 << 16) | (20 << 8) | 30,
};

save.itemPouches[0].items = [{ item: 13, quantity: 5 }]; // Items pouch
save.itemPouches[2].items = [{ item: 4, quantity: 10 }]; // Balls pouch

const out = save.toBytes();
assert(out.length === SAVE_SIZE, 'output save is 128KB');
assert(gen3Module.detect(out), 'exported save passes structural detection');

const reloaded = gen3Module.load(out);
assert(reloaded.trainer.name === 'BRENDAN', `trainer name roundtrip: ${reloaded.trainer.name}`);
assert(reloaded.trainer.id === 40000, `trainer id roundtrip: ${reloaded.trainer.id}`);
assert(reloaded.trainer.money === 500000, `money roundtrip: ${reloaded.trainer.money}`);
assert(reloaded.trainer.badges === 0b10101010, `badges roundtrip: ${reloaded.trainer.badges}`);

const p0 = reloaded.party[0];
assert(p0.speciesId === 257, `party[0] species roundtrip: ${p0.speciesId}`);
assert(p0.nickname === 'BLAZIKEN', `party[0] nickname roundtrip: ${p0.nickname}`);
assert(p0.level === 50, `party[0] level roundtrip: ${p0.level}`);
assert(p0.item === 258, `party[0] held item roundtrip: ${p0.item}`);
assert(p0.friendship === 120, `party[0] friendship roundtrip: ${p0.friendship}`);
assert(JSON.stringify(p0.moves) === JSON.stringify([280, 53, 337, 116]), `party[0] moves roundtrip: ${p0.moves}`);
assert(p0.evs.hp === 252 && p0.evs.atk === 252 && p0.evs.def === 4 && p0.evs.spa === 0 && p0.evs.spd === 0 && p0.evs.spe === 0, `party[0] evs roundtrip: ${JSON.stringify(p0.evs)}`);
assert(p0.ivs.hp === 31 && p0.ivs.atk === 30 && p0.ivs.def === 31 && p0.ivs.spa === 15 && p0.ivs.spd === 20 && p0.ivs.spe === 25, `party[0] ivs roundtrip: ${JSON.stringify(p0.ivs)}`);
// Blaziken has gender ratio 31 (12.5% female); pid&0xFF=6 < 31 -> Female per the Gen3 gender formula.
assert(p0.gender === 'F', `party[0] derived gender: ${p0.gender}`);
assert(p0.nature === 6, `party[0] derived nature (PID%25=6, Bold): ${p0.nature}`);
assert(p0.pid === 6, `party[0] pid preserved: ${p0.pid}`);

const b = reloaded.boxes[2].pokemon[0];
assert(b.speciesId === 321, `box wailord species roundtrip: ${b.speciesId}`);
assert(b.nickname === 'WAILORD', `box wailord nickname roundtrip: ${b.nickname}`);
assert(b.exp === 900000, `box wailord exp roundtrip: ${b.exp}`);
assert(b.ivs.hp === 20, `box wailord hp iv roundtrip (independent in gen3): ${b.ivs.hp}`);

const items = reloaded.itemPouches[0].items;
assert(items.length === 1 && items[0].item === 13 && items[0].quantity === 5, 'items pouch roundtrip (security-key XOR correctly applied)');
const balls = reloaded.itemPouches[2].items;
assert(balls.length === 1 && balls[0].item === 4 && balls[0].quantity === 10, 'balls pouch roundtrip');

// Verify per-sector checksums are all valid after export (structural detection already implies this,
// but check explicitly that every one of the 14 active-slot sectors has a self-consistent checksum).
function sectorChecksum(sectorData) {
  let sum = 0;
  const view = new DataView(sectorData.buffer, sectorData.byteOffset, sectorData.byteLength);
  for (let i = 0; i < SIZE_SECTOR_USED; i += 4) sum = (sum + view.getUint32(i, true)) >>> 0;
  return ((sum & 0xffff) + (sum >>> 16)) & 0xffff;
}
let allChecksumsValid = true;
for (let i = 0; i < 14; i++) {
  const off = i * SIZE_SECTOR;
  const expected = sectorChecksum(out.subarray(off, off + SIZE_SECTOR_USED));
  const actual = out[off + 0xff6] | (out[off + 0xff7] << 8);
  if (expected !== actual) { allChecksumsValid = false; console.log('sector', i, 'checksum mismatch', expected, actual); }
}
assert(allChecksumsValid, 'all 14 sector checksums valid after export');

const out2 = reloaded.toBytes();
let identical = out.length === out2.length;
if (identical) {
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== out2[i]) { identical = false; console.log('first diff at byte', i, out[i], out2[i]); break; }
  }
}
assert(identical, 'export is idempotent (export -> reload -> export gives identical bytes)');

console.log('\nAll Gen3 round-trip checks passed.');
