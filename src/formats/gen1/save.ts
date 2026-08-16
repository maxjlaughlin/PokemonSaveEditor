import type { EditableBox, GenerationCapabilities, ItemSlot, SaveFile, SaveFormatModule } from '../../core/types';
import { decodeGen1Text, encodeGen1Text } from './text';
import { unpackGen1List, packGen1List } from './list';
import { emptyGen1Pokemon } from './pokemon';
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
};

function readBcdMoney(bytes: Uint8Array, offset: number): number {
  let money = 0;
  for (let i = 0; i < 3; i++) {
    const byte = bytes[offset + i];
    money = money * 100 + ((byte >> 4) & 0xf) * 10 + (byte & 0xf);
  }
  return money;
}

function writeBcdMoney(bytes: Uint8Array, offset: number, value: number) {
  let v = Math.max(0, Math.min(999999, Math.floor(value)));
  for (let i = 2; i >= 0; i--) {
    const digits = v % 100;
    v = Math.floor(v / 100);
    bytes[offset + i] = ((Math.floor(digits / 10) & 0xf) << 4) | (digits % 10);
  }
}

function readItems(bytes: Uint8Array, offset: number, capacity: number): ItemSlot[] {
  const count = Math.min(bytes[offset], capacity);
  const items: ItemSlot[] = [];
  for (let i = 0; i < count; i++) {
    const item = bytes[offset + 1 + i * 2];
    const quantity = bytes[offset + 2 + i * 2];
    if (item === 0xff) break;
    items.push({ item, quantity });
  }
  return items;
}

function writeItems(bytes: Uint8Array, offset: number, items: ItemSlot[], capacity: number) {
  const trimmed = items.filter((i) => i.item !== 0 && i.quantity > 0).slice(0, capacity);
  bytes[offset] = trimmed.length;
  trimmed.forEach((slot, i) => {
    bytes[offset + 1 + i * 2] = slot.item;
    bytes[offset + 2 + i * 2] = slot.quantity;
  });
  bytes[offset + 1 + trimmed.length * 2] = 0xff;
}

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
  items: ItemSlot[];
  pcItems: ItemSlot[];
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

    this.items = readItems(this.bytes, o.items, ITEM_BAG_CAPACITY);
    this.pcItems = readItems(this.bytes, o.pcItems, 50);
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

    writeItems(out, o.items, this.items, ITEM_BAG_CAPACITY);
    writeItems(out, o.pcItems, this.pcItems, 50);

    out[o.checksumOfs] = computeChecksum(out, o.ot, o.checksumOfs);
    return out;
  }

  createEmptyPokemon() {
    return emptyGen1Pokemon();
  }
}

export const gen1Module: SaveFormatModule = {
  generation: 1,
  detect(bytes: Uint8Array): boolean {
    if (bytes.length !== SAVE_SIZE) return false;
    const checksum = computeChecksum(bytes, OFFSETS_INT.ot, OFFSETS_INT.checksumOfs);
    return bytes[OFFSETS_INT.checksumOfs] === checksum;
  },
  load(bytes: Uint8Array, fileName: string): SaveFile {
    return new Gen1SaveFile(bytes, fileName);
  },
};
