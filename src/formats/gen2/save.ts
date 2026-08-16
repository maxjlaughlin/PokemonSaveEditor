import type { EditableBox, GenerationCapabilities, ItemPouch, SaveFile, SaveFormatModule } from '../../core/types';
import { decodeGen1Text, encodeGen1Text } from '../gen1/text';
import { unpackGen2List, packGen2List } from './list';
import { emptyGen2Pokemon } from './pokemon';
import { readGbItemList, writeGbItemList } from '../shared/itemList';
import { readBcdMoney, writeBcdMoney } from '../shared/bcd';
import {
  BOX_COUNT,
  BOX_SLOT_COUNT,
  MAX_STRING_LENGTH_NICKNAME,
  MAX_STRING_LENGTH_TRAINER,
  OFFSETS_CRYSTAL,
  OFFSETS_GS,
  PARTY_SLOT_COUNT,
  POUCH_CAPACITY,
  SAVE_SIZE,
  SIZE_BOX_LIST,
  SIZE_PARTY,
  SIZE_PARTY_LIST,
  SIZE_STORED,
  STRING_BUFFER_LENGTH,
  boxRawOffset,
  type Gen2Offsets,
} from './constants';

const CAPABILITIES: GenerationCapabilities = {
  generation: 2,
  hasNature: false,
  hasAbility: false,
  hasHeldItem: true,
  hasGenderField: false, // Gen2 gender is derived from Attack IV, not a stored field
  hasPID: false,
  ivMax: 15,
  hpIvIndependent: false,
  evMax: 65535,
  natDexMax: 251,
  maxMoney: 999999,
  boxCount: BOX_COUNT,
  boxSlotCount: BOX_SLOT_COUNT,
  maxStringLengthTrainer: MAX_STRING_LENGTH_TRAINER,
  maxStringLengthNickname: MAX_STRING_LENGTH_NICKNAME,
  badgeCount: 16,
};

function isListValid(bytes: Uint8Array, offset: number, maxCount: number): boolean {
  const count = bytes[offset];
  return count <= maxCount && bytes[offset + 1 + count] === 0xff;
}

/** Structurally identify GS vs Crystal by checking both the party and current-box list headers, like PKHeX does. */
function identifyVariant(bytes: Uint8Array): { offsets: Gen2Offsets; version: 'GS' | 'Crystal' } | null {
  if (bytes.length !== SAVE_SIZE) return null;
  if (isListValid(bytes, OFFSETS_GS.party, PARTY_SLOT_COUNT) && isListValid(bytes, OFFSETS_GS.currentBox, BOX_SLOT_COUNT)) {
    return { offsets: OFFSETS_GS, version: 'GS' };
  }
  if (isListValid(bytes, OFFSETS_CRYSTAL.party, PARTY_SLOT_COUNT) && isListValid(bytes, OFFSETS_CRYSTAL.currentBox, BOX_SLOT_COUNT)) {
    return { offsets: OFFSETS_CRYSTAL, version: 'Crystal' };
  }
  return null;
}

function computeChecksum(bytes: Uint8Array, o: Gen2Offsets): number {
  let sum = 0;
  for (let i = o.trainer1; i <= o.accumulatedChecksumEnd; i++) sum = (sum + bytes[i]) & 0xffff;
  return sum;
}

class Gen2SaveFile implements SaveFile {
  generation = 2 as const;
  capabilities = CAPABILITIES;
  private bytes: Uint8Array;
  private o: Gen2Offsets;
  gameTitle: string;
  trainer;
  party;
  boxes: EditableBox[];
  itemPouches: ItemPouch[];
  private currentBoxIndex: number;

  constructor(bytes: Uint8Array, version: 'GS' | 'Crystal', offsets: Gen2Offsets) {
    this.bytes = bytes.slice();
    this.o = offsets;
    const o = offsets;
    this.gameTitle = version === 'Crystal' ? 'Pokémon Crystal' : 'Pokémon Gold/Silver';

    this.trainer = {
      name: decodeGen1Text(this.bytes.subarray(o.trainer1 + 2, o.trainer1 + 2 + STRING_BUFFER_LENGTH)),
      id: (this.bytes[o.trainer1] << 8) | this.bytes[o.trainer1 + 1],
      money: readBcdMoney(this.bytes, o.money),
      badges: this.bytes[o.johtoBadges] | (this.bytes[o.johtoBadges + 1] << 8),
    };

    const partyList = this.bytes.subarray(o.party, o.party + SIZE_PARTY_LIST);
    this.party = unpackGen2List(partyList, PARTY_SLOT_COUNT, SIZE_PARTY);

    this.currentBoxIndex = this.bytes[o.currentBoxIndex];
    this.boxes = [];
    for (let i = 0; i < BOX_COUNT; i++) {
      const off = boxRawOffset(i);
      const listBytes = this.bytes.subarray(off, off + SIZE_BOX_LIST);
      this.boxes.push({ name: `Box ${i + 1}`, pokemon: unpackGen2List(listBytes, BOX_SLOT_COUNT, SIZE_STORED) });
    }

    this.itemPouches = [
      { name: 'Items', capacity: POUCH_CAPACITY.item, items: readGbItemList(this.bytes, o.pouchItem, POUCH_CAPACITY.item) },
      { name: 'Key Items', capacity: POUCH_CAPACITY.key, items: readGbItemList(this.bytes, o.pouchKey, POUCH_CAPACITY.key) },
      { name: 'Balls', capacity: POUCH_CAPACITY.ball, items: readGbItemList(this.bytes, o.pouchBall, POUCH_CAPACITY.ball) },
      { name: 'TMs/HMs', capacity: POUCH_CAPACITY.tmhm, items: readGbItemList(this.bytes, o.pouchTMHM, POUCH_CAPACITY.tmhm) },
      { name: 'PC', capacity: POUCH_CAPACITY.pc, items: readGbItemList(this.bytes, o.pouchPC, POUCH_CAPACITY.pc) },
    ];
  }

  toBytes(): Uint8Array {
    const out = this.bytes.slice();
    const o = this.o;

    out.set(encodeGen1Text(this.trainer.name, STRING_BUFFER_LENGTH), o.trainer1 + 2);
    out[o.trainer1] = (this.trainer.id >> 8) & 0xff;
    out[o.trainer1 + 1] = this.trainer.id & 0xff;
    writeBcdMoney(out, o.money, this.trainer.money);
    out[o.johtoBadges] = this.trainer.badges & 0xff;
    out[o.johtoBadges + 1] = (this.trainer.badges >> 8) & 0xff;

    const partyList = packGen2List(this.party, PARTY_SLOT_COUNT, SIZE_PARTY);
    out.set(partyList, o.party);

    for (let i = 0; i < BOX_COUNT; i++) {
      const listBytes = packGen2List(this.boxes[i].pokemon, BOX_SLOT_COUNT, SIZE_STORED);
      out.set(listBytes, boxRawOffset(i));
      if (i === this.currentBoxIndex) out.set(listBytes, o.currentBox);
    }

    writeGbItemList(out, o.pouchItem, this.itemPouches[0].items, POUCH_CAPACITY.item);
    writeGbItemList(out, o.pouchKey, this.itemPouches[1].items, POUCH_CAPACITY.key);
    writeGbItemList(out, o.pouchBall, this.itemPouches[2].items, POUCH_CAPACITY.ball);
    writeGbItemList(out, o.pouchTMHM, this.itemPouches[3].items, POUCH_CAPACITY.tmhm);
    writeGbItemList(out, o.pouchPC, this.itemPouches[4].items, POUCH_CAPACITY.pc);

    const checksum = computeChecksum(out, o);
    out[o.overallChecksumPosition] = checksum & 0xff;
    out[o.overallChecksumPosition + 1] = (checksum >> 8) & 0xff;
    out[o.overallChecksumPosition2] = checksum & 0xff;
    out[o.overallChecksumPosition2 + 1] = (checksum >> 8) & 0xff;

    return out;
  }

  createEmptyPokemon() {
    return emptyGen2Pokemon();
  }
}

export const gen2Module: SaveFormatModule = {
  generation: 2,
  detect(bytes: Uint8Array): boolean {
    const variant = identifyVariant(bytes);
    if (!variant) return false;
    const checksum = computeChecksum(bytes, variant.offsets);
    const actual = bytes[variant.offsets.overallChecksumPosition] | (bytes[variant.offsets.overallChecksumPosition + 1] << 8);
    return checksum === actual;
  },
  load(bytes: Uint8Array, _fileName: string): SaveFile {
    const variant = identifyVariant(bytes);
    if (!variant) throw new Error('Not a recognized Gen2 (Gold/Silver/Crystal) save file.');
    return new Gen2SaveFile(bytes, variant.version, variant.offsets);
  },
};
