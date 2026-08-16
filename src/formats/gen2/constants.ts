// Generation II (Gold/Silver/Crystal) save file layout constants, international/English versions only.
// Offsets verified against community-documented Gen II save structure.

export const SAVE_SIZE = 0x8000;

export const BOX_COUNT = 14;
export const BOX_SLOT_COUNT = 20;
export const PARTY_SLOT_COUNT = 6;
export const BOX_SPLIT_INDEX = 7; // boxes 0-6 live in bank 0x4000, boxes 7-13 in bank 0x6000

export const SIZE_STORED = 32; // box Pokemon struct size
export const SIZE_PARTY = 48; // party Pokemon struct size

export const STRING_BUFFER_LENGTH = 11;
export const MAX_STRING_LENGTH_TRAINER = 7;
export const MAX_STRING_LENGTH_NICKNAME = 10;

export function listLength(capacity: number, bodySize: number): number {
  return 1 + (capacity + 1) + bodySize * capacity + STRING_BUFFER_LENGTH * capacity * 2;
}

export const SIZE_BOX_LIST = listLength(BOX_SLOT_COUNT, SIZE_STORED);
export const SIZE_PARTY_LIST = listLength(PARTY_SLOT_COUNT, SIZE_PARTY);

export function boxRawOffset(box: number): number {
  if (box < BOX_SPLIT_INDEX) return 0x4000 + box * (SIZE_BOX_LIST + 2);
  return 0x6000 + (box - BOX_SPLIT_INDEX) * (SIZE_BOX_LIST + 2);
}

export interface Gen2Offsets {
  trainer1: number; // TID (2 bytes) then OT name
  rival: number;
  timePlayed: number;
  money: number;
  johtoBadges: number; // 2-byte LE: low byte Johto badges, high byte Kanto badges
  currentBoxIndex: number;
  currentBox: number;
  party: number;
  pokedexCaught: number;
  pokedexSeen: number;
  gender: number; // -1 if not applicable (GS has no player gender)
  accumulatedChecksumEnd: number;
  overallChecksumPosition: number;
  overallChecksumPosition2: number;
  pouchTMHM: number;
  pouchItem: number;
  pouchKey: number;
  pouchBall: number;
  pouchPC: number;
  eventFlag: number;
}

export const OFFSETS_GS: Gen2Offsets = {
  trainer1: 0x2009,
  rival: 0x2021,
  timePlayed: 0x2053,
  money: 0x23db,
  johtoBadges: 0x23e4,
  currentBoxIndex: 0x2724,
  currentBox: 0x2d6c,
  party: 0x288a,
  pokedexCaught: 0x2a4c,
  pokedexSeen: 0x2a6c,
  gender: -1,
  accumulatedChecksumEnd: 0x2d68,
  overallChecksumPosition: 0x2d69,
  overallChecksumPosition2: 0x7e6d,
  pouchTMHM: 0x23e6,
  pouchItem: 0x241f,
  pouchKey: 0x2449,
  pouchBall: 0x2464,
  pouchPC: 0x247e,
  eventFlag: 0x2724 - 0x105,
};

export const OFFSETS_CRYSTAL: Gen2Offsets = {
  trainer1: 0x2009,
  rival: 0x2021,
  timePlayed: 0x2052,
  money: 0x23dc,
  johtoBadges: 0x23e5,
  currentBoxIndex: 0x2700,
  currentBox: 0x2d10,
  party: 0x2865,
  pokedexCaught: 0x2a27,
  pokedexSeen: 0x2a47,
  gender: 0x3e3d,
  accumulatedChecksumEnd: 0x2b82,
  overallChecksumPosition: 0x2d0d,
  overallChecksumPosition2: 0x1f0d,
  pouchTMHM: 0x23e7,
  pouchItem: 0x2420,
  pouchKey: 0x244a,
  pouchBall: 0x2465,
  pouchPC: 0x247f,
  eventFlag: 0x2700 - 0x100,
};

export const POUCH_CAPACITY = {
  tmhm: 57,
  item: 20,
  key: 26,
  ball: 12,
  pc: 50,
} as const;
