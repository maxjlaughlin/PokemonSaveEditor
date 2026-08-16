import type { EditableBox, GenerationCapabilities, ItemPouch, SaveFile, SaveFormatModule } from '../../core/types';
import { decodeGen4Text, encodeGen4Text } from './text';
import { readGen4Pokemon, writeGen4Pokemon, emptyGen4Pokemon } from './pokemon';
import { readGen4ItemPocket, writeGen4ItemPocket } from './itemPocket';
import { crc16ccitt } from './checksum';
import {
  GEN4_ITEMS_GENERAL_DP, GEN4_ITEMS_GENERAL_PT, GEN4_KEY_DP, GEN4_KEY_PT, GEN4_KEY_HGSS,
  GEN4_MACHINE, GEN4_MAIL, GEN4_MEDICINE, GEN4_BERRY, GEN4_BALLS_DPPT, GEN4_BALLS_HGSS, GEN4_BATTLE,
} from '../../data/itemPocketsGen4';
import {
  BOX_COUNT, BOX_NAME_LENGTH_CHARS, BOX_SLOT_COUNT, MAX_STRING_LENGTH_NICKNAME, MAX_STRING_LENGTH_TRAINER,
  OFFSETS, PARTITION_SIZE, PARTY_SLOT_COUNT, SIZE_4PARTY, SIZE_4STORED, type Gen4Offsets, type Gen4Version,
} from './constants';

const CAPABILITIES: GenerationCapabilities = {
  generation: 4,
  hasNature: true,
  hasAbility: true,
  hasHeldItem: true,
  hasGenderField: true, // Gen4 stores gender directly, unlike Gen2/3
  hasPID: true,
  ivMax: 31,
  hpIvIndependent: true,
  evMax: 255,
  natDexMax: 493,
  maxMoney: 999999,
  boxCount: BOX_COUNT,
  boxSlotCount: BOX_SLOT_COUNT,
  maxStringLengthTrainer: MAX_STRING_LENGTH_TRAINER,
  maxStringLengthNickname: MAX_STRING_LENGTH_NICKNAME,
  badgeCount: 8,
};

function readU32LE(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function writeU32LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; }
function readU16LE(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8); }
function writeU16LE(b: Uint8Array, o: number, v: number) { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; }

function blockChecksumValid(bytes: Uint8Array, start: number, size: number, footerSize: number): boolean {
  if (start + size > bytes.length) return false;
  const block = bytes.subarray(start, start + size);
  const calc = crc16ccitt(block.subarray(0, size - footerSize));
  const saved = readU16LE(block, size - 2);
  return calc === saved;
}

function compareCounters(c1: number, c2: number): number {
  if (c1 === 0xffffffff && c2 !== 0xfffffffe) return 1;
  if (c2 === 0xffffffff && c1 !== 0xfffffffe) return 0;
  if (c1 > c2) return 0;
  if (c1 < c2) return 1;
  return 0;
}

/** Picks which partition (0 or 1) holds the active copy of a block, or null if neither validates. */
function pickActivePartition(bytes: Uint8Array, startWithinPartition: number, size: number, footerSize: number): number | null {
  const off0 = startWithinPartition;
  const off1 = PARTITION_SIZE + startWithinPartition;
  const valid0 = blockChecksumValid(bytes, off0, size, footerSize);
  const valid1 = blockChecksumValid(bytes, off1, size, footerSize);
  if (!valid0 && !valid1) return null;
  if (!valid1) return 0;
  if (!valid0) return 1;
  const footerOff = size - footerSize;
  const major0 = readU32LE(bytes, off0 + footerOff);
  const major1 = readU32LE(bytes, off1 + footerOff);
  return compareCounters(major0, major1);
}

function detectGen4(bytes: Uint8Array): { version: Gen4Version; generalPartition: number; storagePartition: number } | null {
  for (const version of ['DP', 'Pt', 'HGSS'] as const) {
    const o = OFFSETS[version];
    const generalPartition = pickActivePartition(bytes, 0, o.generalSize, o.footerSize);
    const storagePartition = pickActivePartition(bytes, o.storageStart, o.storageSize, o.footerSize);
    if (generalPartition !== null && storagePartition !== null) {
      return { version, generalPartition, storagePartition };
    }
  }
  return null;
}

function pocketsForVersion(version: Gen4Version) {
  const general = version === 'DP' ? GEN4_ITEMS_GENERAL_DP : GEN4_ITEMS_GENERAL_PT;
  const key = version === 'DP' ? GEN4_KEY_DP : version === 'Pt' ? GEN4_KEY_PT : GEN4_KEY_HGSS;
  const balls = version === 'HGSS' ? GEN4_BALLS_HGSS : GEN4_BALLS_DPPT;
  return [
    { name: 'Items', whitelist: general },
    { name: 'Key Items', whitelist: key },
    { name: 'TMs & HMs', whitelist: GEN4_MACHINE },
    { name: 'Mail', whitelist: GEN4_MAIL },
    { name: 'Medicine', whitelist: GEN4_MEDICINE },
    { name: 'Berries', whitelist: GEN4_BERRY },
    { name: 'Poké Balls', whitelist: balls },
    { name: 'Battle Items', whitelist: GEN4_BATTLE },
  ];
}

/** Pocket byte offsets, relative to the inventory base, in the fixed order used by pocketsForVersion. */
const POCKET_OFFSETS = [0x000, 0x294, 0x35c, 0x4ec, 0x51c, 0x5bc, 0x6bc, 0x6f8];
const POCKET_OFFSETS_HGSS = [0x000, 0x294, 0x35c, 0x4f0, 0x520, 0x5c0, 0x6c0, 0x720];

function pocketOffsets(version: Gen4Version): number[] {
  return version === 'HGSS' ? POCKET_OFFSETS_HGSS : POCKET_OFFSETS;
}

class Gen4SaveFile implements SaveFile {
  generation = 4 as const;
  capabilities = CAPABILITIES;
  gameTitle: string;
  trainer;
  party;
  boxes: EditableBox[];
  itemPouches: ItemPouch[];

  private originalBytes: Uint8Array;
  private version: Gen4Version;
  private o: Gen4Offsets;
  private generalOriginal: Uint8Array;
  private storageOriginal: Uint8Array;

  constructor(bytes: Uint8Array, version: Gen4Version, generalPartition: number, storagePartition: number) {
    this.originalBytes = bytes.slice();
    this.version = version;
    const o = this.o = OFFSETS[version];
    this.gameTitle = version === 'DP' ? 'Pokémon Diamond/Pearl' : version === 'Pt' ? 'Pokémon Platinum' : 'Pokémon HeartGold/SoulSilver';

    const gOff = generalPartition === 0 ? 0 : PARTITION_SIZE;
    const sOff = (storagePartition === 0 ? 0 : PARTITION_SIZE) + o.storageStart;
    this.generalOriginal = this.originalBytes.slice(gOff, gOff + o.generalSize);
    this.storageOriginal = this.originalBytes.slice(sOff, sOff + o.storageSize);

    const general = this.generalOriginal;
    const storage = this.storageOriginal;
    const t = o.trainer1;

    this.trainer = {
      name: decodeGen4Text(general.subarray(t, t + 16)),
      id: readU16LE(general, t + 0x10),
      money: readU32LE(general, t + 0x14),
      badges: general[t + 0x1a] | (o.badges16 ? general[t + 0x1f] << 8 : 0),
    };

    this.party = [];
    for (let i = 0; i < PARTY_SLOT_COUNT; i++) {
      const off = o.party + i * SIZE_4PARTY;
      this.party.push(readGen4Pokemon(general.subarray(off, off + SIZE_4PARTY)));
    }

    this.boxes = [];
    const boxNameBase = o.boxDataStart + BOX_COUNT * o.boxChunkSize + (o.currentBoxAtEnd ? 8 : 0);
    for (let b = 0; b < BOX_COUNT; b++) {
      const pokemon = [];
      for (let s = 0; s < BOX_SLOT_COUNT; s++) {
        const off = o.boxDataStart + b * o.boxChunkSize + s * SIZE_4STORED;
        pokemon.push(readGen4Pokemon(storage.subarray(off, off + SIZE_4STORED)));
      }
      const nameOff = boxNameBase + b * (BOX_NAME_LENGTH_CHARS * 2);
      const name = decodeGen4Text(storage.subarray(nameOff, nameOff + BOX_NAME_LENGTH_CHARS * 2));
      this.boxes.push({ name: name || `Box ${b + 1}`, pokemon });
    }

    const pockets = pocketsForVersion(version);
    const offsets = pocketOffsets(version);
    this.itemPouches = pockets.map((p, i) => ({
      name: p.name,
      capacity: p.whitelist.length,
      items: readGen4ItemPocket(general, o.inventory + offsets[i], p.whitelist),
    }));
  }

  toBytes(): Uint8Array {
    const o = this.o;
    const general = this.generalOriginal.slice();
    const storage = this.storageOriginal.slice();
    const t = o.trainer1;

    general.set(encodeGen4Text(this.trainer.name, 8), t);
    writeU16LE(general, t + 0x10, this.trainer.id & 0xffff);
    writeU32LE(general, t + 0x14, this.trainer.money);
    general[t + 0x1a] = this.trainer.badges & 0xff;
    if (o.badges16) general[t + 0x1f] = (this.trainer.badges >> 8) & 0xff;

    for (let i = 0; i < PARTY_SLOT_COUNT; i++) {
      const off = o.party + i * SIZE_4PARTY;
      writeGen4Pokemon(this.party[i], general.subarray(off, off + SIZE_4PARTY));
    }
    general[o.party - 4] = this.party.filter((p) => !p.isEmpty).length;

    const boxNameBase = o.boxDataStart + BOX_COUNT * o.boxChunkSize + (o.currentBoxAtEnd ? 8 : 0);
    for (let b = 0; b < BOX_COUNT; b++) {
      for (let s = 0; s < BOX_SLOT_COUNT; s++) {
        const off = o.boxDataStart + b * o.boxChunkSize + s * SIZE_4STORED;
        writeGen4Pokemon(this.boxes[b].pokemon[s], storage.subarray(off, off + SIZE_4STORED));
      }
      const nameOff = boxNameBase + b * (BOX_NAME_LENGTH_CHARS * 2);
      storage.set(encodeGen4Text(this.boxes[b].name, BOX_NAME_LENGTH_CHARS), nameOff);
    }

    const pockets = pocketsForVersion(this.version);
    const offsets = pocketOffsets(this.version);
    pockets.forEach((p, i) => {
      writeGen4ItemPocket(general, o.inventory + offsets[i], p.whitelist, this.itemPouches[i].items);
    });

    // Recompute checksums and mirror the updated General/Storage blocks into BOTH partitions, so the
    // save is valid no matter which one the game picks as "active" on next load.
    const out = this.originalBytes.slice();
    writeU16LE(general, o.generalSize - 2, crc16ccitt(general.subarray(0, o.generalSize - o.footerSize)));
    writeU16LE(storage, o.storageSize - 2, crc16ccitt(storage.subarray(0, o.storageSize - o.footerSize)));

    out.set(general, 0);
    out.set(general, PARTITION_SIZE);
    out.set(storage, o.storageStart);
    out.set(storage, PARTITION_SIZE + o.storageStart);

    return out;
  }

  createEmptyPokemon() {
    return emptyGen4Pokemon();
  }
}

export const gen4Module: SaveFormatModule = {
  generation: 4,
  detect(bytes: Uint8Array): boolean {
    return detectGen4(bytes) !== null;
  },
  load(bytes: Uint8Array): SaveFile {
    const info = detectGen4(bytes);
    if (!info) throw new Error('Not a recognized Gen4 (Diamond/Pearl/Platinum/HeartGold/SoulSilver) save file.');
    return new Gen4SaveFile(bytes, info.version, info.generalPartition, info.storagePartition);
  },
};
