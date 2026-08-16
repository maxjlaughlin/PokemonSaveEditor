// Quick synthetic round-trip validation for the Gen1 save module.
// Run with: npx tsx this-file.mjs  (from project root, after `npm i -D tsx` if needed)
import { gen1Module } from '../src/formats/gen1/save.ts';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK:', msg);
}

// Build a minimal synthetic Gen1 save (all zeros, then populate key fields).
const bytes = new Uint8Array(0x8000);
// Party count = 0 initially -> we'll load then edit via the loaded object, not by hand-crafting bytes.

const save = gen1Module.load(bytes, 'test.sav');
assert(save.party.length === 6, 'party has 6 slots');
assert(save.boxes.length === 12, '12 boxes');
assert(save.boxes[0].pokemon.length === 20, 'box has 20 slots');

// Edit trainer
save.trainer.name = 'ASH';
save.trainer.id = 12345;
save.trainer.money = 3000;
save.trainer.badges = 0b10101010;

// Edit first party slot: Charizard (National #6), level 36
save.party[0] = {
  ...save.party[0],
  isEmpty: false,
  speciesId: 6,
  nickname: 'CHARIZARD',
  level: 36,
  currentHp: 999, // will get clamped/whatever - just verifying byte roundtrip, not game-legality
  status: 0,
  moves: [52, 53, 38, 82], // ember, wing attack (arbitrary ids for structural test), fire spin?, dragon rage
  movePp: [30, 20, 10, 5],
  ppUps: [0, 1, 0, 3],
  otName: 'ASH',
  otId: 12345,
  exp: 100000,
  evs: { hp: 5000, atk: 6000, def: 7000, spa: 8000, spd: 8000, spe: 9000 },
  ivs: { hp: 0, atk: 15, def: 9, spa: 8, spd: 8, spe: 12 }, // hp IV is derived in Gen1, not independently stored
};

// Edit a box pokemon: Mewtwo (#150) in box 3, slot 0
save.boxes[2].pokemon[0] = {
  ...save.boxes[2].pokemon[0],
  isEmpty: false,
  speciesId: 150,
  nickname: 'MEWTWO',
  level: 70,
  currentHp: 200,
  moves: [1, 2, 3, 4],
  movePp: [10, 10, 10, 10],
  ppUps: [0, 0, 0, 0],
  otName: 'ASH',
  otId: 12345,
  exp: 500000,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
};

save.itemPouches[0].items = [{ item: 1, quantity: 5 }, { item: 4, quantity: 1 }];

const out = save.toBytes();
assert(out.length === 0x8000, 'output save is 32KB');

// Reload from the exported bytes and verify everything survived the round trip.
assert(gen1Module.detect(out), 'exported save passes checksum detection');
const reloaded = gen1Module.load(out, 'test.sav');

assert(reloaded.trainer.name === 'ASH', `trainer name roundtrip: ${reloaded.trainer.name}`);
assert(reloaded.trainer.id === 12345, `trainer id roundtrip: ${reloaded.trainer.id}`);
assert(reloaded.trainer.money === 3000, `money roundtrip: ${reloaded.trainer.money}`);
assert(reloaded.trainer.badges === 0b10101010, `badges roundtrip: ${reloaded.trainer.badges}`);

const p0 = reloaded.party[0];
assert(p0.speciesId === 6, `party[0] species roundtrip: ${p0.speciesId}`);
assert(p0.nickname === 'CHARIZARD', `party[0] nickname roundtrip: ${p0.nickname}`);
assert(p0.level === 36, `party[0] level roundtrip: ${p0.level}`);
assert(JSON.stringify(p0.moves) === JSON.stringify([52, 53, 38, 82]), `party[0] moves roundtrip: ${p0.moves}`);
assert(p0.ivs.atk === 15 && p0.ivs.def === 9 && p0.ivs.spe === 12, `party[0] ivs roundtrip: ${JSON.stringify(p0.ivs)}`);
assert(p0.ivs.hp === 12, `party[0] derived hp iv: ${p0.ivs.hp}`); // derived from atk/def/spe/spc low bits
assert(p0.otName === 'ASH', `party[0] OT roundtrip: ${p0.otName}`);
assert(p0.otId === 12345, `party[0] OT id roundtrip: ${p0.otId}`);

for (let i = 1; i < 6; i++) {
  assert(reloaded.party[i].isEmpty, `party[${i}] still empty`);
}

const b = reloaded.boxes[2].pokemon[0];
assert(b.speciesId === 150, `box mewtwo species roundtrip: ${b.speciesId}`);
assert(b.nickname === 'MEWTWO', `box mewtwo nickname roundtrip: ${b.nickname}`);
assert(b.level === 70, `box mewtwo level roundtrip: ${b.level}`);
assert(b.ivs.hp === 15 && b.ivs.spe === 15, `box mewtwo ivs roundtrip: ${JSON.stringify(b.ivs)}`);

const items = reloaded.itemPouches[0].items;
assert(items.length === 2, `items count roundtrip: ${items.length}`);
assert(items[0].item === 1 && items[0].quantity === 5, 'item[0] roundtrip');
assert(items[1].item === 4 && items[1].quantity === 1, 'item[1] roundtrip');

// double-export idempotency: exporting twice from the same in-memory state should be byte-identical
const out2 = reloaded.toBytes();
let identical = out.length === out2.length;
if (identical) {
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== out2[i]) { identical = false; console.log('first diff at byte', i, out[i], out2[i]); break; }
  }
}
assert(identical, 'export is idempotent (export -> reload -> export gives identical bytes)');

console.log('\nAll Gen1 round-trip checks passed.');
