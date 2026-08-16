// Synthetic round-trip validation for the Gen2 (Crystal) save module.
import { gen2Module } from '../src/formats/gen2/save.ts';
import { OFFSETS_CRYSTAL } from '../src/formats/gen2/constants.ts';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK:', msg);
}

// Build a minimal synthetic Crystal save: empty (count=0, terminator=0xFF) party/box list headers.
const bytes = new Uint8Array(0x8000);
bytes[OFFSETS_CRYSTAL.party] = 0;
bytes[OFFSETS_CRYSTAL.party + 1] = 0xff;
bytes[OFFSETS_CRYSTAL.currentBox] = 0;
bytes[OFFSETS_CRYSTAL.currentBox + 1] = 0xff;

assert(!gen2Module.detect(bytes), 'blank buffer does not pass checksum detection yet');
const save = gen2Module.load(bytes, 'test.sav');
assert(save.gameTitle === 'Pokémon Crystal', `identified as Crystal: ${save.gameTitle}`);
assert(save.party.length === 6, 'party has 6 slots');
assert(save.boxes.length === 14, '14 boxes');
assert(save.boxes[0].pokemon.length === 20, 'box has 20 slots');
assert(save.itemPouches.length === 5, '5 item pouches');

save.trainer.name = 'KRIS';
save.trainer.id = 54321;
save.trainer.money = 123456;
save.trainer.badges = 0b1111111111111111; // all 16 badges

// Slot 0: Typhlosion holding a Leftovers. Gender ratio 31 (7:1 male) -> threshold=round(31/16)=2,
// atk DV 10 >= 2 -> Male. def/spe/spc DV=10 and atk DV has bit 0x2 set (10 & 2 = 2) -> Shiny.
save.party[0] = {
  ...save.party[0],
  isEmpty: false,
  speciesId: 157, // Typhlosion
  nickname: 'TYPHLOSION',
  level: 45,
  currentHp: 120,
  status: 0,
  moves: [53, 52, 7, 89],
  movePp: [15, 25, 15, 10],
  ppUps: [0, 2, 0, 1],
  otName: 'KRIS',
  otId: 54321,
  exp: 300000,
  evs: { hp: 1000, atk: 2000, def: 3000, spa: 4000, spd: 4000, spe: 5000 },
  ivs: { hp: 0, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 },
  item: 84, // arbitrary held item id, just checking it round-trips
  friendship: 200,
};

// Slot 1: Suicune (genderless) in box 5
save.boxes[4].pokemon[0] = {
  ...save.boxes[4].pokemon[0],
  isEmpty: false,
  speciesId: 245, // Suicune
  nickname: 'SUICUNE',
  level: 40,
  moves: [57, 59, 240, 130],
  movePp: [5, 10, 10, 10],
  ppUps: [0, 0, 0, 0],
  otName: 'KRIS',
  otId: 54321,
  exp: 250000,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 0, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
  item: 0,
  friendship: 70,
};

save.itemPouches[0].items = [{ item: 5, quantity: 3 }]; // Items pouch: Antidote x3
save.itemPouches[2].items = [{ item: 4, quantity: 1 }]; // Balls pouch: Poke Ball x1

const out = save.toBytes();
assert(out.length === 0x8000, 'output save is 32KB');
assert(gen2Module.detect(out), 'exported save passes checksum detection');

const reloaded = gen2Module.load(out, 'test.sav');
assert(reloaded.trainer.name === 'KRIS', `trainer name roundtrip: ${reloaded.trainer.name}`);
assert(reloaded.trainer.id === 54321, `trainer id roundtrip: ${reloaded.trainer.id}`);
assert(reloaded.trainer.money === 123456, `money roundtrip: ${reloaded.trainer.money}`);
assert(reloaded.trainer.badges === 0b1111111111111111, `badges roundtrip: ${reloaded.trainer.badges}`);

const p0 = reloaded.party[0];
assert(p0.speciesId === 157, `party[0] species roundtrip: ${p0.speciesId}`);
assert(p0.nickname === 'TYPHLOSION', `party[0] nickname roundtrip: ${p0.nickname}`);
assert(p0.level === 45, `party[0] level roundtrip: ${p0.level}`);
assert(p0.item === 84, `party[0] held item roundtrip: ${p0.item}`);
assert(p0.friendship === 200, `party[0] friendship roundtrip: ${p0.friendship}`);
assert(p0.isShiny === true, `party[0] derived shiny: ${p0.isShiny}`);
assert(p0.gender === 'M', `party[0] derived gender (atk dv 10 >= threshold 2 -> male): ${p0.gender}`);
assert(JSON.stringify(p0.moves) === JSON.stringify([53, 52, 7, 89]), `party[0] moves roundtrip: ${p0.moves}`);

const b = reloaded.boxes[4].pokemon[0];
assert(b.speciesId === 245, `box suicune species roundtrip: ${b.speciesId}`);
assert(b.gender === 'U', `suicune (genderless) roundtrip gender: ${b.gender}`);
assert(b.level === 40, `box suicune level roundtrip: ${b.level}`);

const items = reloaded.itemPouches[0].items;
assert(items.length === 1 && items[0].item === 5 && items[0].quantity === 3, 'items pouch roundtrip');
const balls = reloaded.itemPouches[2].items;
assert(balls.length === 1 && balls[0].item === 4 && balls[0].quantity === 1, 'balls pouch roundtrip');

const out2 = reloaded.toBytes();
let identical = out.length === out2.length;
if (identical) {
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== out2[i]) { identical = false; console.log('first diff at byte', i, out[i], out2[i]); break; }
  }
}
assert(identical, 'export is idempotent (export -> reload -> export gives identical bytes)');

console.log('\nAll Gen2 round-trip checks passed.');
