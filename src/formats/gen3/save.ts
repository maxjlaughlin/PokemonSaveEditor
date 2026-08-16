import type { EditableBox, GenerationCapabilities, ItemPouch, SaveFile, SaveFormatModule } from '../../core/types';
import { decodeGen3Text, encodeGen3Text } from './text';
import { readGen3Pokemon, writeGen3Pokemon, emptyGen3Pokemon } from './pokemon';
import {
  BOX_COUNT,
  BOX_SLOT_COUNT,
  COUNT_MAIN_SECTORS,
  MAX_STRING_LENGTH_NICKNAME,
  MAX_STRING_LENGTH_TRAINER,
  OFFSETS,
  PARTY_SLOT_COUNT,
  SAVE_SIZE,
  SIZE_3PARTY,
  SIZE_3STORED,
  SIZE_MAIN,
  SIZE_SECTOR,
  SIZE_SECTOR_USED,
  SMALL_GENDER,
  SMALL_OT_NAME,
  SMALL_SECURITY_KEY_E,
  SMALL_SECURITY_KEY_FRLG,
  SMALL_SID,
  SMALL_TID,
  STORAGE_BOX_DATA_START,
  STORAGE_BOX_NAME_LENGTH,
  STORAGE_CURRENT_BOX,
  type Gen3Version,
} from './constants';

const CAPABILITIES: GenerationCapabilities = {
  generation: 3,
  hasNature: true,
  hasAbility: true,
  hasHeldItem: true,
  hasGenderField: false, // gender is derived from PID, not an editable field
  hasPID: true,
  ivMax: 31,
  hpIvIndependent: true,
  evMax: 255,
  natDexMax: 386,
  maxMoney: 999999,
  boxCount: BOX_COUNT,
  boxSlotCount: BOX_SLOT_COUNT,
  maxStringLengthTrainer: MAX_STRING_LENGTH_TRAINER,
  maxStringLengthNickname: MAX_STRING_LENGTH_NICKNAME,
  badgeCount: 8,
};

function readU16LE(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8); }
function writeU16LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; }
function readI16LE(b: Uint8Array, o: number): number { return (readU16LE(b, o) << 16) >> 16; }
function readU32LE(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function writeU32LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; }

function getFlag(bytes: Uint8Array, byteOffset: number, bit: number): boolean {
  return (bytes[byteOffset] & (1 << bit)) !== 0;
}
function setFlag(bytes: Uint8Array, byteOffset: number, bit: number, value: boolean) {
  bytes[byteOffset] = value ? bytes[byteOffset] | (1 << bit) : bytes[byteOffset] & ~(1 << bit);
}

function sectorChecksum(sectorData0xF80: Uint8Array): number {
  let sum = 0;
  const view = new DataView(sectorData0xF80.buffer, sectorData0xF80.byteOffset, sectorData0xF80.byteLength);
  for (let i = 0; i < SIZE_SECTOR_USED; i += 4) sum = (sum + view.getUint32(i, true)) >>> 0;
  return ((sum & 0xffff) + (sum >>> 16)) & 0xffff;
}

/** Which of the two 0xE000 save regions is the most recently written (higher save counter). */
function findActiveSlot(bytes: Uint8Array): number {
  const counter = (slot: number) => readU32LE(bytes, slot * SIZE_MAIN + 0xffc);
  return counter(1) > counter(0) ? 1 : 0;
}

interface SectorMap {
  /** physical sector index (0-13) -> section id read from that sector's footer */
  idByPhysical: number[];
}

function readSectorMap(bytes: Uint8Array, slot: number): SectorMap {
  const idByPhysical: number[] = [];
  for (let i = 0; i < COUNT_MAIN_SECTORS; i++) {
    const off = slot * SIZE_MAIN + i * SIZE_SECTOR;
    idByPhysical.push(readI16LE(bytes, off + 0xff4));
  }
  return { idByPhysical };
}

function getChunkDest(id: number, small: Uint8Array, large: Uint8Array, storage: Uint8Array): Uint8Array | null {
  if (id === 0) return small;
  if (id >= 1 && id <= 4) return large.subarray((id - 1) * SIZE_SECTOR_USED, id * SIZE_SECTOR_USED);
  if (id >= 5 && id <= 13) return storage.subarray((id - 5) * SIZE_SECTOR_USED, (id - 5 + 1) * SIZE_SECTOR_USED);
  return null;
}

function detectVersion(small: Uint8Array): Gen3Version {
  const val = readU32LE(small, 0xac);
  if (val === 1) return 'FRLG';
  if (val === 0) {
    for (let i = 0x890; i < 0xf2c && i < small.length; i++) {
      if (small[i] !== 0) return 'E';
    }
    return 'RS';
  }
  return 'E';
}

function readItemPocket(bytes: Uint8Array, offset: number, capacity: number, securityKey: number): ItemPouch['items'] {
  const items: ItemPouch['items'] = [];
  for (let i = 0; i < capacity; i++) {
    const o = offset + i * 4;
    const item = readU16LE(bytes, o);
    const quantity = readU16LE(bytes, o + 2) ^ (securityKey & 0xffff);
    if (item !== 0 && quantity > 0) items.push({ item, quantity });
  }
  return items;
}

function writeItemPocket(bytes: Uint8Array, offset: number, capacity: number, items: ItemPouch['items'], securityKey: number) {
  const trimmed = items.filter((i) => i.item !== 0 && i.quantity > 0).slice(0, capacity);
  for (let i = 0; i < capacity; i++) {
    const o = offset + i * 4;
    const slot = trimmed[i];
    writeU16LE(bytes, o, slot ? slot.item : 0);
    writeU16LE(bytes, o + 2, slot ? (slot.quantity ^ (securityKey & 0xffff)) : 0);
  }
}

class Gen3SaveFile implements SaveFile {
  generation = 3 as const;
  capabilities = CAPABILITIES;
  gameTitle: string;
  trainer;
  party;
  boxes: EditableBox[];
  itemPouches: ItemPouch[];

  private originalBytes: Uint8Array;
  private activeSlot: number;
  private version: Gen3Version;
  private smallOriginal: Uint8Array;
  private largeOriginal: Uint8Array;
  private storageOriginal: Uint8Array;
  private securityKey: number;

  constructor(bytes: Uint8Array) {
    this.originalBytes = bytes.slice();
    this.activeSlot = findActiveSlot(this.originalBytes);
    const map = readSectorMap(this.originalBytes, this.activeSlot);

    const small = new Uint8Array(SIZE_SECTOR_USED);
    const large = new Uint8Array(4 * SIZE_SECTOR_USED);
    const storage = new Uint8Array(9 * SIZE_SECTOR_USED);
    for (let physIdx = 0; physIdx < COUNT_MAIN_SECTORS; physIdx++) {
      const id = map.idByPhysical[physIdx];
      const dest = getChunkDest(id, small, large, storage);
      if (!dest) continue;
      const off = this.activeSlot * SIZE_MAIN + physIdx * SIZE_SECTOR;
      dest.set(this.originalBytes.subarray(off, off + SIZE_SECTOR_USED));
    }
    this.smallOriginal = small;
    this.largeOriginal = large;
    this.storageOriginal = storage;

    this.version = detectVersion(small);
    this.gameTitle = this.version === 'E' ? 'Pokémon Emerald' : this.version === 'FRLG' ? 'Pokémon FireRed/LeafGreen' : 'Pokémon Ruby/Sapphire';
    this.securityKey = this.version === 'E' ? readU32LE(small, SMALL_SECURITY_KEY_E)
      : this.version === 'FRLG' ? readU32LE(small, SMALL_SECURITY_KEY_FRLG) : 0;

    const off = OFFSETS[this.version];

    this.trainer = {
      name: decodeGen3Text(small.subarray(SMALL_OT_NAME, SMALL_OT_NAME + 8)),
      id: readU16LE(small, SMALL_TID),
      money: readU32LE(large, off.money) ^ this.securityKey,
      badges: this.readBadges(large, off.eventFlagBase, off.badgeFlagStart),
    };

    const partyCount = Math.min(large[off.partyCount], PARTY_SLOT_COUNT);
    this.party = [];
    for (let i = 0; i < PARTY_SLOT_COUNT; i++) {
      if (i >= partyCount) { this.party.push(emptyGen3Pokemon()); continue; }
      const raw = large.subarray(off.party + i * SIZE_3PARTY, off.party + (i + 1) * SIZE_3PARTY);
      this.party.push(readGen3Pokemon(raw));
    }

    this.boxes = [];
    for (let b = 0; b < BOX_COUNT; b++) {
      const pokemon = [];
      for (let s = 0; s < BOX_SLOT_COUNT; s++) {
        const o = STORAGE_BOX_DATA_START + (b * BOX_SLOT_COUNT + s) * SIZE_3STORED;
        pokemon.push(readGen3Pokemon(storage.subarray(o, o + SIZE_3STORED)));
      }
      this.boxes.push({ name: this.readBoxName(storage, b), pokemon });
    }

    const p = off.pockets;
    const cap = off.pocketCapacities;
    this.itemPouches = [
      { name: 'Items', capacity: cap.items, items: readItemPocket(large, off.inventory + p.items, cap.items, this.securityKey) },
      { name: 'Key Items', capacity: cap.keyItems, items: readItemPocket(large, off.inventory + p.keyItems, cap.keyItems, this.securityKey) },
      { name: 'Poké Balls', capacity: cap.balls, items: readItemPocket(large, off.inventory + p.balls, cap.balls, this.securityKey) },
      { name: 'TMs & HMs', capacity: cap.tmhm, items: readItemPocket(large, off.inventory + p.tmhm, cap.tmhm, this.securityKey) },
      { name: 'Berries', capacity: cap.berries, items: readItemPocket(large, off.inventory + p.berries, cap.berries, this.securityKey) },
      { name: 'PC', capacity: cap.pcItems, items: readItemPocket(large, off.inventory + p.pcItems, cap.pcItems, 0) },
    ];
  }

  private readBadges(large: Uint8Array, eventFlagBase: number, badgeFlagStart: number): number {
    let val = 0;
    for (let i = 0; i < 8; i++) {
      const flag = badgeFlagStart + i;
      if (getFlag(large, eventFlagBase + (flag >> 3), flag & 7)) val |= 1 << i;
    }
    return val;
  }

  private writeBadges(large: Uint8Array, eventFlagBase: number, badgeFlagStart: number, value: number) {
    for (let i = 0; i < 8; i++) {
      const flag = badgeFlagStart + i;
      setFlag(large, eventFlagBase + (flag >> 3), flag & 7, (value & (1 << i)) !== 0);
    }
  }

  private readBoxName(storage: Uint8Array, box: number): string {
    const off = STORAGE_BOX_DATA_START + BOX_COUNT * BOX_SLOT_COUNT * SIZE_3STORED + box * STORAGE_BOX_NAME_LENGTH;
    const name = decodeGen3Text(storage.subarray(off, off + STORAGE_BOX_NAME_LENGTH));
    return name || `Box ${box + 1}`;
  }

  toBytes(): Uint8Array {
    const small = this.smallOriginal.slice();
    const large = this.largeOriginal.slice();
    const storage = this.storageOriginal.slice();
    const off = OFFSETS[this.version];

    small.set(encodeGen3Text(this.trainer.name, 8), SMALL_OT_NAME);
    writeU16LE(small, SMALL_TID, this.trainer.id & 0xffff);
    // Preserve original SID (not exposed for editing) - already present in `small` since we cloned it.
    void SMALL_SID;
    void SMALL_GENDER;

    writeU32LE(large, off.money, (this.trainer.money ^ this.securityKey) >>> 0);
    this.writeBadges(large, off.eventFlagBase, off.badgeFlagStart, this.trainer.badges);

    const present = this.party.filter((p) => !p.isEmpty && p.speciesId !== 0).slice(0, PARTY_SLOT_COUNT);
    large[off.partyCount] = present.length;
    for (let i = 0; i < PARTY_SLOT_COUNT; i++) {
      const raw = large.subarray(off.party + i * SIZE_3PARTY, off.party + (i + 1) * SIZE_3PARTY);
      writeGen3Pokemon(present[i] ?? emptyGen3Pokemon(), raw);
    }

    for (let b = 0; b < BOX_COUNT; b++) {
      for (let s = 0; s < BOX_SLOT_COUNT; s++) {
        const o = STORAGE_BOX_DATA_START + (b * BOX_SLOT_COUNT + s) * SIZE_3STORED;
        writeGen3Pokemon(this.boxes[b].pokemon[s], storage.subarray(o, o + SIZE_3STORED));
      }
      const nameOff = STORAGE_BOX_DATA_START + BOX_COUNT * BOX_SLOT_COUNT * SIZE_3STORED + b * STORAGE_BOX_NAME_LENGTH;
      storage.set(encodeGen3Text(this.boxes[b].name, STORAGE_BOX_NAME_LENGTH), nameOff);
    }
    void STORAGE_CURRENT_BOX;

    const p = off.pockets;
    const cap = off.pocketCapacities;
    writeItemPocket(large, off.inventory + p.items, cap.items, this.itemPouches[0].items, this.securityKey);
    writeItemPocket(large, off.inventory + p.keyItems, cap.keyItems, this.itemPouches[1].items, this.securityKey);
    writeItemPocket(large, off.inventory + p.balls, cap.balls, this.itemPouches[2].items, this.securityKey);
    writeItemPocket(large, off.inventory + p.tmhm, cap.tmhm, this.itemPouches[3].items, this.securityKey);
    writeItemPocket(large, off.inventory + p.berries, cap.berries, this.itemPouches[4].items, this.securityKey);
    writeItemPocket(large, off.inventory + p.pcItems, cap.pcItems, this.itemPouches[5].items, 0);

    const out = this.originalBytes.slice();
    const map = readSectorMap(this.originalBytes, this.activeSlot);
    for (let physIdx = 0; physIdx < COUNT_MAIN_SECTORS; physIdx++) {
      const id = map.idByPhysical[physIdx];
      const chunk = getChunkDest(id, small, large, storage);
      if (!chunk) continue;
      const sectorOff = this.activeSlot * SIZE_MAIN + physIdx * SIZE_SECTOR;
      out.set(chunk, sectorOff);
      const checksum = sectorChecksum(out.subarray(sectorOff, sectorOff + SIZE_SECTOR_USED));
      writeU16LE(out, sectorOff + 0xff6, checksum);
    }

    return out;
  }

  createEmptyPokemon() {
    return emptyGen3Pokemon();
  }
}

function isSectorMapComplete(bytes: Uint8Array, slot: number): boolean {
  const seen = new Set<number>();
  for (let i = 0; i < COUNT_MAIN_SECTORS; i++) {
    const off = slot * SIZE_MAIN + i * SIZE_SECTOR;
    const id = readI16LE(bytes, off + 0xff4);
    if (id < 0 || id >= COUNT_MAIN_SECTORS) return false;
    seen.add(id);
  }
  return seen.size === COUNT_MAIN_SECTORS;
}

export const gen3Module: SaveFormatModule = {
  generation: 3,
  detect(bytes: Uint8Array): boolean {
    if (bytes.length !== SAVE_SIZE) return false;
    return isSectorMapComplete(bytes, 0) || isSectorMapComplete(bytes, 1);
  },
  load(bytes: Uint8Array): SaveFile {
    return new Gen3SaveFile(bytes);
  },
};
