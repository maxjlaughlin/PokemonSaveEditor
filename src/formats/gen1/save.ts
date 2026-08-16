import type { EditableBox, GenerationCapabilities, ItemPouch, SaveFile, SaveFormatModule } from '../../core/types';
import { decodeGen1Text, encodeGen1Text } from './text';
import { unpackGen1List, packGen1List } from './list';
import { emptyGen1Pokemon } from './pokemon';
import { readGbItemList, writeGbItemList } from '../shared/itemList';
import { readBcdMoney, writeBcdMoney } from '../shared/bcd';
import {
  BOX_COUNT,
  BOX_SLOT_COUNT,
  MAX_STRING_LENGTH_NICKNAME,
  MAX_STRING_LENGTH_TRAINER,
  OFFSETS_INT,
  PARTY_SLOT_COUNT,
  SAVE_SIZE,
  SIZE_BOX_LIST,
  SIZE_PARTY,
  SIZE_PARTY_LIST,
  SIZE_STORED,
  STRING_BUFFER_LENGTH,
  boxRawOffset,
} from './constants';

const ITEM_BAG_CAPACITY = 20;
const PC_ITEM_CAPACITY = 50;

const CAPABILITIES: GenerationCapabilities = {
  generation: 1,
  hasNature: false,
  hasAbility: false,
  hasHeldItem: false,
  hasGenderField: false,
  hasPID: false,
  ivMax: 15,
  evMax: 65535,
  natDexMax: 151,
  maxMoney: 999999,
  boxCount: BOX_COUNT,
  boxSlotCount: BOX_SLOT_COUNT,
  maxStringLengthTrainer: MAX_STRING_LENGTH_TRAINER,
  maxStringLengthNickname: MAX_STRING_LENGTH_NICKNAME,
  badgeCount: 8,
};

function computeChecksum(bytes: Uint8Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum = (sum + bytes[i]) & 0xff;
  return (~sum) & 0xff;
}

class Gen1SaveFile implements SaveFile {
  generation = 1 as const;
  capabilities = CAPABILITIES;
  private bytes: Uint8Array;
  gameTitle: string;
  trainer;
  party;
  boxes: EditableBox[];
  itemPouches: ItemPouch[];
  private currentBoxIndex: number;

  constructor(bytes: Uint8Array, fileName: string) {
    this.bytes = bytes.slice();
    const o = OFFSETS_INT;

    this.trainer = {
      name: decodeGen1Text(this.bytes.subarray(o.ot, o.ot + STRING_BUFFER_LENGTH)),
      id: (this.bytes[o.tid] << 8) | this.bytes[o.tid + 1],
      money: readBcdMoney(this.bytes, o.money),
      badges: this.bytes[o.badges],
    };

    const starter = this.bytes[o.starter];
    this.gameTitle = fileName.toLowerCase().includes('yellow') || starter === 0x54 ? 'Pokémon Yellow' : 'Pokémon Red/Blue';

    const partyList = this.bytes.subarray(o.party, o.party + SIZE_PARTY_LIST);
    this.party = unpackGen1List(partyList, PARTY_SLOT_COUNT, SIZE_PARTY);

    this.currentBoxIndex = this.bytes[o.currentBoxIndex];
    this.boxes = [];
    for (let i = 0; i < BOX_COUNT; i++) {
      const listBytes = i === this.currentBoxIndex
        ? this.bytes.subarray(o.currentBox, o.currentBox + SIZE_BOX_LIST)
        : this.bytes.subarray(boxRawOffset(i), boxRawOffset(i) + SIZE_BOX_LIST);
      this.boxes.push({ name: `Box ${i + 1}`, pokemon: unpackGen1List(listBytes, BOX_SLOT_COUNT, SIZE_STORED) });
    }

    this.itemPouches = [
      { name: 'Items', capacity: ITEM_BAG_CAPACITY, items: readGbItemList(this.bytes, o.items, ITEM_BAG_CAPACITY) },
      { name: 'PC', capacity: PC_ITEM_CAPACITY, items: readGbItemList(this.bytes, o.pcItems, PC_ITEM_CAPACITY) },
    ];
  }

  toBytes(): Uint8Array {
    const out = this.bytes.slice();
    const o = OFFSETS_INT;

    out.set(encodeGen1Text(this.trainer.name, STRING_BUFFER_LENGTH), o.ot);
    out[o.tid] = (this.trainer.id >> 8) & 0xff;
    out[o.tid + 1] = this.trainer.id & 0xff;
    writeBcdMoney(out, o.money, this.trainer.money);
    out[o.badges] = this.trainer.badges;

    const partyList = packGen1List(this.party, PARTY_SLOT_COUNT, SIZE_PARTY);
    out.set(partyList, o.party);

    for (let i = 0; i < BOX_COUNT; i++) {
      const listBytes = packGen1List(this.boxes[i].pokemon, BOX_SLOT_COUNT, SIZE_STORED);
      out.set(listBytes, boxRawOffset(i));
      if (i === this.currentBoxIndex) out.set(listBytes, o.currentBox);
    }

    writeGbItemList(out, o.items, this.itemPouches[0].items, ITEM_BAG_CAPACITY);
    writeGbItemList(out, o.pcItems, this.itemPouches[1].items, PC_ITEM_CAPACITY);

    out[o.checksumOfs] = computeChecksum(out, o.ot, o.checksumOfs);
    return out;
  }

  createEmptyPokemon() {
    return emptyGen1Pokemon();
  }
}

function isListValid(bytes: Uint8Array, offset: number, maxCount: number): boolean {
  const count = bytes[offset];
  return count <= maxCount && bytes[offset + 1 + count] === 0xff;
}

export const gen1Module: SaveFormatModule = {
  generation: 1,
  detect(bytes: Uint8Array): boolean {
    if (bytes.length !== SAVE_SIZE) return false;
    const o = OFFSETS_INT;
    // Structural check first (like the party/box list headers) to avoid colliding with same-sized
    // Gen2 saves, then confirm with the checksum.
    if (!isListValid(bytes, o.party, PARTY_SLOT_COUNT) || !isListValid(bytes, o.currentBox, BOX_SLOT_COUNT)) return false;
    const checksum = computeChecksum(bytes, o.ot, o.checksumOfs);
    return bytes[o.checksumOfs] === checksum;
  },
  load(bytes: Uint8Array, fileName: string): SaveFile {
    return new Gen1SaveFile(bytes, fileName);
  },
};
