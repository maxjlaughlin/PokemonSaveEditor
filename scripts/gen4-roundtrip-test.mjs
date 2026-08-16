// Synthetic round-trip validation for the Gen4 (Platinum) save module.
import { gen4Module } from '../src/formats/gen4/save.ts';
import { OFFSETS, PARTITION_SIZE } from '../src/formats/gen4/constants.ts';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK:', msg);
}

function crc16ccitt(data) {
  let top = 0xff, bot = 0xff;
  for (const b of data) {
    let x = (b ^ top) & 0xff;
    x ^= x >> 4;
    top = (bot ^ (x >> 3) ^ (x << 4)) & 0xff;
    bot = (x ^ (x << 5)) & 0xff;
  }
  return ((top << 8) | bot) & 0xffff;
}

function buildSave(version) {
  const o = OFFSETS[version];
  const totalSize = 2 * PARTITION_SIZE;
  const bytes = new Uint8Array(totalSize);

  // Write valid (empty) General/Storage blocks with correct checksums into partition 0 only.
  // Partition 1 stays all-zero (invalid checksum), so partition 0 is unambiguously picked as active.
  const general = new Uint8Array(o.generalSize);
  writeChecksum(general, o.generalSize, o.footerSize);
  bytes.set(general, 0);

  const storage = new Uint8Array(o.storageSize);
  writeChecksum(storage, o.storageSize, o.footerSize);
  bytes.set(storage, o.storageStart);

  return bytes;
}

function writeChecksum(block, size, footerSize) {
  const chk = crc16ccitt(block.subarray(0, size - footerSize));
  block[size - 2] = chk & 0xff;
  block[size - 1] = (chk >> 8) & 0xff;
}

const bytes = buildSave('Pt');
assert(gen4Module.detect(bytes), 'synthetic Platinum buffer passes structural detection');
const save = gen4Module.load(bytes);
assert(save.gameTitle === 'Pokémon Platinum', `identified as Platinum: ${save.gameTitle}`);
assert(save.party.length === 6, 'party has 6 slots');
assert(save.boxes.length === 18, '18 boxes');
assert(save.boxes[0].pokemon.length === 30, 'box has 30 slots');
assert(save.itemPouches.length === 8, '8 item pockets');

save.trainer.name = 'LUCAS';
save.trainer.id = 22222;
save.trainer.money = 250000;
save.trainer.badges = 0b11110000;

// Slot 0: Garchomp (male-only-ish ratio irrelevant since gender is stored directly in Gen4)
save.party[0] = {
  ...save.party[0],
  isEmpty: false,
  speciesId: 445, // Garchomp
  nickname: 'GARCHOMP',
  level: 55,
  currentHp: 180,
  status: 0,
  moves: [231, 89, 444, 348],
  movePp: [15, 10, 10, 24],
  ppUps: [3, 0, 1, 0],
  otName: 'LUCAS',
  otId: 22222,
  exp: 200000,
  evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 20, spa: 15, spd: 25, spe: 31 },
  item: 214, // arbitrary held item id
  friendship: 100,
  ability: 76, // Sand Veil
  gender: 'F',
  pid: 999999,
  metInfo: (0 << 16) | (0 << 8) | (0 << 7) | 45,
};

// Box slot: Rotom in box 5, box format (no independent level, only exp)
save.boxes[4].pokemon[0] = {
  ...save.boxes[4].pokemon[0],
  isEmpty: false,
  speciesId: 479, // Rotom
  nickname: 'ROTOM',
  moves: [86, 87, 315, 261],
  movePp: [10, 10, 10, 15],
  ppUps: [0, 0, 0, 0],
  otName: 'LUCAS',
  otId: 22222,
  exp: 300000,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 12, atk: 8, def: 30, spa: 31, spd: 18, spe: 22 },
  item: 0,
  friendship: 70,
  ability: 106, // Levitate
  gender: 'U',
  pid: 55555,
  metInfo: (0 << 16) | (0 << 8) | (0 << 7) | 20,
};

save.itemPouches[0].items = [{ item: 84, quantity: 3 }]; // Items pocket (Sitrus Berry range excluded, use a General-pocket item)
save.itemPouches[6].items = [{ item: 4, quantity: 5 }]; // Balls pocket: Great Ball

const out = save.toBytes();
assert(out.length === bytes.length, 'output save is the same total size');
assert(gen4Module.detect(out), 'exported save passes structural detection');

const reloaded = gen4Module.load(out);
assert(reloaded.trainer.name === 'LUCAS', `trainer name roundtrip: ${reloaded.trainer.name}`);
assert(reloaded.trainer.id === 22222, `trainer id roundtrip: ${reloaded.trainer.id}`);
assert(reloaded.trainer.money === 250000, `money roundtrip: ${reloaded.trainer.money}`);
assert(reloaded.trainer.badges === 0b11110000, `badges roundtrip: ${reloaded.trainer.badges}`);

const p0 = reloaded.party[0];
assert(p0.speciesId === 445, `party[0] species roundtrip: ${p0.speciesId}`);
assert(p0.nickname === 'GARCHOMP', `party[0] nickname roundtrip: ${p0.nickname}`);
assert(p0.level === 55, `party[0] level roundtrip: ${p0.level}`);
assert(p0.item === 214, `party[0] held item roundtrip: ${p0.item}`);
assert(p0.friendship === 100, `party[0] friendship roundtrip: ${p0.friendship}`);
assert(p0.ability === 76, `party[0] ability roundtrip (directly stored in gen4): ${p0.ability}`);
assert(p0.gender === 'F', `party[0] gender roundtrip (directly stored in gen4): ${p0.gender}`);
assert(p0.ivs.hp === 31 && p0.ivs.spa === 15 && p0.ivs.spe === 31, `party[0] ivs roundtrip: ${JSON.stringify(p0.ivs)}`);
assert(JSON.stringify(p0.moves) === JSON.stringify([231, 89, 444, 348]), `party[0] moves roundtrip: ${p0.moves}`);

const b = reloaded.boxes[4].pokemon[0];
assert(b.speciesId === 479, `box rotom species roundtrip: ${b.speciesId}`);
assert(b.nickname === 'ROTOM', `box rotom nickname roundtrip: ${b.nickname}`);
assert(b.gender === 'U', `box rotom gender roundtrip: ${b.gender}`);
assert(b.exp === 300000, `box rotom exp roundtrip: ${b.exp}`);
assert(b.ivs.spa === 31, `box rotom hp iv independent: ${b.ivs.spa}`);

const items = reloaded.itemPouches[0].items;
assert(items.length === 1 && items[0].item === 84 && items[0].quantity === 3, 'items pocket roundtrip');
const balls = reloaded.itemPouches[6].items;
assert(balls.length === 1 && balls[0].item === 4 && balls[0].quantity === 5, 'balls pocket roundtrip');

const out2 = reloaded.toBytes();
let identical = out.length === out2.length;
if (identical) {
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== out2[i]) { identical = false; console.log('first diff at byte', i, out[i], out2[i]); break; }
  }
}
assert(identical, 'export is idempotent (export -> reload -> export gives identical bytes)');

// Sanity-check HGSS variant detection separately (different offsets/box layout entirely).
const hgssBytes = buildSave('HGSS');
assert(gen4Module.detect(hgssBytes), 'synthetic HGSS buffer passes structural detection');
const hgssSave = gen4Module.load(hgssBytes);
assert(hgssSave.gameTitle === 'Pokémon HeartGold/SoulSilver', `identified as HGSS: ${hgssSave.gameTitle}`);
hgssSave.trainer.name = 'ETHAN';
hgssSave.trainer.badges = 0b1111111111111111; // 16 badges (Johto+Kanto)
hgssSave.party[0] = { ...hgssSave.party[0], isEmpty: false, speciesId: 157, nickname: 'TYPHLOSION', level: 40, moves: [53, 52, 7, 89], movePp: [15, 25, 15, 10], ppUps: [0, 0, 0, 0], otName: 'ETHAN', otId: 1, exp: 100000, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, item: 0, friendship: 70, ability: 66, gender: 'M', pid: 42, metInfo: 5 };
const hgssOut = hgssSave.toBytes();
const hgssReloaded = gen4Module.load(hgssOut);
assert(hgssReloaded.trainer.name === 'ETHAN', `HGSS trainer name roundtrip: ${hgssReloaded.trainer.name}`);
assert(hgssReloaded.trainer.badges === 0b1111111111111111, `HGSS 16-badge roundtrip: ${hgssReloaded.trainer.badges}`);
assert(hgssReloaded.party[0].speciesId === 157, `HGSS party species roundtrip: ${hgssReloaded.party[0].speciesId}`);

console.log('\nAll Gen4 round-trip checks passed.');
