// Generation III (RSE/FRLG) save file layout constants, international/English versions only.

export const SAVE_SIZE = 0x20000; // 128KB: two 0xE000 main save regions + HoF/extra data

export const SIZE_SECTOR = 0x1000;
export const SIZE_SECTOR_USED = 0xf80;
export const COUNT_MAIN_SECTORS = 14; // per save slot
export const SIZE_MAIN = COUNT_MAIN_SECTORS * SIZE_SECTOR; // 0xE000

export const SIZE_3STORED = 80;
export const SIZE_3PARTY = 100;
export const SIZE_3HEADER = 32; // unencrypted header before the 4 encrypted 12-byte substructures
export const SIZE_3BLOCK = 12;

export const BOX_COUNT = 14;
export const BOX_SLOT_COUNT = 30;
export const PARTY_SLOT_COUNT = 6;

export const MAX_STRING_LENGTH_TRAINER = 7;
export const MAX_STRING_LENGTH_NICKNAME = 10;

/**
 * For a given PID%24 shuffle value, gives the logical substructure index (0=Growth,1=Attack,
 * 2=EVs/Condition,3=Miscellaneous) stored at each of the four physical 12-byte block positions.
 */
export const BLOCK_ORDER: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
];

export type Gen3Version = 'RS' | 'E' | 'FRLG';

export interface Gen3ItemPocketOffsets {
  pcItems: number;
  items: number;
  keyItems: number;
  balls: number;
  tmhm: number;
  berries: number;
}

export interface Gen3PocketCapacities {
  pcItems: number;
  items: number;
  keyItems: number;
  balls: number;
  tmhm: number;
  berries: number;
}

export interface Gen3Offsets {
  partyCount: number;
  party: number;
  money: number;
  coin: number;
  inventory: number;
  eventFlagBase: number; // Large-block-relative offset of the event flag bit array
  badgeFlagStart: number; // flag NUMBER (bit index), not byte offset
  pockets: Gen3ItemPocketOffsets;
  pocketCapacities: Gen3PocketCapacities;
}

const RS_POCKETS: Gen3ItemPocketOffsets = { pcItems: 0x000, items: 0x0c8, keyItems: 0x118, balls: 0x168, tmhm: 0x1a8, berries: 0x2a8 };
const RS_CAPACITIES: Gen3PocketCapacities = { pcItems: 50, items: 20, keyItems: 20, balls: 16, tmhm: 64, berries: 46 };

const E_POCKETS: Gen3ItemPocketOffsets = { pcItems: 0x000, items: 0x0c8, keyItems: 0x140, balls: 0x1b8, tmhm: 0x1f8, berries: 0x2f8 };
const E_CAPACITIES: Gen3PocketCapacities = { pcItems: 50, items: 30, keyItems: 30, balls: 16, tmhm: 64, berries: 46 };

const FRLG_POCKETS: Gen3ItemPocketOffsets = { pcItems: 0x000, items: 0x078, keyItems: 0x120, balls: 0x198, tmhm: 0x1cc, berries: 0x2b4 };
const FRLG_CAPACITIES: Gen3PocketCapacities = { pcItems: 30, items: 42, keyItems: 30, balls: 13, tmhm: 58, berries: 43 };

export const OFFSETS: Record<Gen3Version, Gen3Offsets> = {
  RS: {
    partyCount: 0x234, party: 0x238, money: 0x490, coin: 0x494, inventory: 0x498,
    eventFlagBase: 0x1220, badgeFlagStart: 0x807,
    pockets: RS_POCKETS, pocketCapacities: RS_CAPACITIES,
  },
  E: {
    partyCount: 0x234, party: 0x238, money: 0x490, coin: 0x494, inventory: 0x498,
    eventFlagBase: 0x1270, badgeFlagStart: 0x867,
    pockets: E_POCKETS, pocketCapacities: E_CAPACITIES,
  },
  FRLG: {
    partyCount: 0x034, party: 0x038, money: 0x290, coin: 0x294, inventory: 0x298,
    eventFlagBase: 0xee0, badgeFlagStart: 0x820,
    pockets: FRLG_POCKETS, pocketCapacities: FRLG_CAPACITIES,
  },
};

// Small-block (trainer info) offsets - identical across RS/E/FRLG.
export const SMALL_OT_NAME = 0x00; // 8 bytes (7 chars + terminator)
export const SMALL_GENDER = 0x08;
export const SMALL_TID = 0x0a;
export const SMALL_SID = 0x0c;
export const SMALL_SECURITY_KEY_E = 0xac;
export const SMALL_SECURITY_KEY_FRLG = 0xf20;

// Storage (PC box) layout - identical across versions.
export const STORAGE_CURRENT_BOX = 0x00;
export const STORAGE_BOX_DATA_START = 0x04;
export const STORAGE_BOX_NAME_LENGTH = 9;
