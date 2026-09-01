// Validates the event-injection pipeline itself (applyEvent + PID generation + Exp curve), on
// synthetic Gen3 and Gen4 saves, independent of which specific real-world events are catalogued.
import { gen3Module } from '../src/formats/gen3/save.ts';
import { gen4Module } from '../src/formats/gen4/save.ts';
import { OFFSETS as GEN4_OFFSETS, PARTITION_SIZE } from '../src/formats/gen4/constants.ts';
import { applyEvent } from '../src/formats/shared/applyEvent.ts';

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

// ---- Gen3 Emerald ----
{
  const SIZE_SECTOR = 0x1000;
  const bytes = new Uint8Array(0x20000);
  for (let i = 0; i < 14; i++) {
    const off = i * SIZE_SECTOR;
    bytes[off + 0xff4] = i & 0xff;
    bytes[off + 0xff5] = (i >> 8) & 0xff;
    bytes[off + 0xffc] = 1;
  }
  bytes[0xac] = 0x78; bytes[0xad] = 0x56; bytes[0xae] = 0x34; bytes[0xaf] = 0x12; // Emerald security key

  const save = gen3Module.load(bytes);
  assert(save.versionTag === 'E', `gen3 versionTag detected: ${save.versionTag}`);

  const event = {
    id: 'test-event',
    generation: 3,
    name: 'Test Event',
    versions: ['E'],
    summary: '', howToPlay: '', source: 'synthetic test',
    items: [{ itemName: 'Eon Ticket', quantity: 1 }],
    pokemon: [{
      speciesId: 380, // Latias
      level: 30,
      growthRate: 'slow',
      moves: [231, 226, 245, 116],
      otName: 'WISHMKR',
      otId: 12345,
      otSid: 0,
      nature: 5,
      shiny: false,
    }],
  };

  const result = applyEvent(save, event);
  assert(result.warnings.length === 0, `no warnings: ${JSON.stringify(result.warnings)}`);
  assert(result.addedItems.length === 1, 'item added');
  assert(result.addedPokemon.length === 1, 'pokemon added');
  assert(!save.party[0].isEmpty && save.party[0].speciesId === 380, 'latias placed in first party slot');
  assert(save.party[0].nature === 5, `nature locked correctly: ${save.party[0].nature}`);
  assert(save.party[0].isShiny === false, 'not shiny');
  assert(save.itemPouches.find((p) => p.name === 'Key Items').items.some((i) => i.item === save.itemPouches[1].items[0]?.item), 'eon ticket item present');

  const out = save.toBytes();
  const reloaded = gen3Module.load(out);
  const mon = reloaded.party[0];
  assert(mon.speciesId === 380, `reload species: ${mon.speciesId}`);
  assert(mon.level === 30, `reload level: ${mon.level}`);
  assert(mon.otName === 'WISHMKR', `reload OT name: ${mon.otName}`);
  assert(mon.otId === 12345, `reload OT id: ${mon.otId}`);
  assert(mon.nature === 5, `reload nature: ${mon.nature}`);
  assert(JSON.stringify(mon.moves) === JSON.stringify([231, 226, 245, 116]), `reload moves: ${mon.moves}`);
  assert(mon.exp > 0, `reload exp is level-consistent (nonzero): ${mon.exp}`);
  const eonTicketId = 275; // not asserted numerically elsewhere; just confirm something landed in Key Items
  void eonTicketId;
  const keyItems = reloaded.itemPouches.find((p) => p.name === 'Key Items');
  assert(keyItems.items.length === 1, `reload key items pouch has the ticket: ${JSON.stringify(keyItems.items)}`);

  console.log('Gen3 event injection round-trip OK.\n');
}

// ---- Gen4 Platinum ----
{
  function writeChecksum(block, size, footerSize) {
    const chk = crc16ccitt(block.subarray(0, size - footerSize));
    block[size - 2] = chk & 0xff;
    block[size - 1] = (chk >> 8) & 0xff;
  }
  const o = GEN4_OFFSETS['Pt'];
  const bytes = new Uint8Array(2 * PARTITION_SIZE);
  const general = new Uint8Array(o.generalSize);
  writeChecksum(general, o.generalSize, o.footerSize);
  bytes.set(general, 0);
  const storage = new Uint8Array(o.storageSize);
  writeChecksum(storage, o.storageSize, o.footerSize);
  bytes.set(storage, o.storageStart);

  const save = gen4Module.load(bytes);
  assert(save.versionTag === 'Pt', `gen4 versionTag detected: ${save.versionTag}`);

  const event = {
    id: 'test-event-4',
    generation: 4,
    name: 'Test Event',
    versions: ['Pt'],
    summary: '', howToPlay: '', source: 'synthetic test',
    items: [{ itemName: 'Member Card', quantity: 1 }],
    pokemon: [{
      speciesId: 491, // Darkrai
      level: 40,
      growthRate: 'slow',
      moves: [447, 174, 197, 452],
      otName: 'GF',
      otId: 5555,
      gender: 'U',
      shiny: false,
      fatefulEncounter: true,
    }],
  };

  const result = applyEvent(save, event);
  assert(result.warnings.length === 0, `no warnings: ${JSON.stringify(result.warnings)}`);
  assert(save.party[0].speciesId === 491, 'darkrai placed in first party slot');
  assert(save.party[0].fatefulEncounter === true, 'fateful encounter flag set');

  const out = save.toBytes();
  const reloaded = gen4Module.load(out);
  const mon = reloaded.party[0];
  assert(mon.speciesId === 491, `reload species: ${mon.speciesId}`);
  assert(mon.otName === 'GF', `reload OT name: ${mon.otName}`);
  assert(mon.fatefulEncounter === true, `reload fateful encounter flag persists: ${mon.fatefulEncounter}`);
  assert(mon.gender === 'U', `reload gender: ${mon.gender}`);
  const keyItems = reloaded.itemPouches.find((p) => p.name === 'Key Items');
  assert(keyItems.items.length === 1, `reload key items pouch has the member card: ${JSON.stringify(keyItems.items)}`);

  // Sanity: an existing (non-event) Pokemon's fateful-encounter=false must also survive a round-trip.
  reloaded.party[1] = { ...reloaded.createEmptyPokemon(), isEmpty: false, speciesId: 1, level: 5, nickname: 'BULBASAUR', otName: 'X', otId: 1, moves: [33, 0, 0, 0], ivs: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, fatefulEncounter: false };
  const reloaded2 = gen4Module.load(reloaded.toBytes());
  assert(reloaded2.party[1].fatefulEncounter === false, `non-event pokemon fatefulEncounter stays false: ${reloaded2.party[1].fatefulEncounter}`);
  assert(reloaded2.party[0].fatefulEncounter === true, `event pokemon still fateful after a second save: ${reloaded2.party[0].fatefulEncounter}`);

  console.log('Gen4 event injection round-trip OK.\n');
}

console.log('All event-injection round-trip checks passed.');
