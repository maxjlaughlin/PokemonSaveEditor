// Generation I (Red/Blue/Yellow) save file layout constants.
// Offsets verified against community-documented Gen I save structure (international/English version).

export const SAVE_SIZE = 0x8000;

export const OFFSETS_INT = {
  ot: 0x2598,
  dexCaught: 0x25a3,
  dexSeen: 0x25b6,
  items: 0x25c9, // count byte, then up to 20 (item,qty) pairs, terminated by 0xff
  money: 0x25f3, // 3 bytes BCD
  rival: 0x25f6,
  options: 0x2601,
  badges: 0x2602, // 1 byte bitfield
  tid: 0x2605, // 2 bytes big-endian
  pcItems: 0x27e6,
  currentBoxIndex: 0x284c,
  starter: 0x29c3,
  party: 0x2f2c,
  currentBox: 0x30c0,
  checksumOfs: 0x3523,
} as const;

export const MAX_STRING_LENGTH_TRAINER = 7;
export const MAX_STRING_LENGTH_NICKNAME = 10;
export const STRING_BUFFER_LENGTH = 11; // on-disk fixed slot length for name/nickname (int'l)

export const BOX_COUNT = 12;
export const BOX_SLOT_COUNT = 20;
export const PARTY_SLOT_COUNT = 6;

export const SIZE_STORED = 33; // box Pokemon struct size
export const SIZE_PARTY = 44; // party Pokemon struct size (stored + current stats)

/** Total byte length of one multi-slot list (species header + bodies + OT names + nicknames). */
export function listLength(capacity: number, bodySize: number): number {
  return 1 + (capacity + 1) + bodySize * capacity + STRING_BUFFER_LENGTH * capacity * 2;
}

export const SIZE_BOX_LIST = listLength(BOX_SLOT_COUNT, SIZE_STORED);
export const SIZE_PARTY_LIST = listLength(PARTY_SLOT_COUNT, SIZE_PARTY);

export function boxRawOffset(box: number): number {
  const half = BOX_COUNT / 2;
  if (box < half) return 0x4000 + box * SIZE_BOX_LIST;
  return 0x6000 + (box - half) * SIZE_BOX_LIST;
}

export const SLOT_EMPTY = 0xff;
