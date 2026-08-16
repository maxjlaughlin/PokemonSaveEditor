// Generation IV (Diamond/Pearl/Platinum/HeartGold/SoulSilver) save file layout constants,
// international/English versions only.

export const SIZE_4STORED = 136;
export const SIZE_4PARTY = 236;
export const SIZE_4HEADER = 8; // PID(4) + Sanity(2) + Checksum(2), unencrypted
export const SIZE_4BLOCK = 32; // 4 logical blocks x 32 bytes = 128 bytes (0x08-0x88)

export const BOX_COUNT = 18;
export const BOX_SLOT_COUNT = 30;
export const PARTY_SLOT_COUNT = 6;

export const MAX_STRING_LENGTH_TRAINER = 7;
export const MAX_STRING_LENGTH_NICKNAME = 10;

/**
 * Same shuffle permutation family as Gen3, but with a 32-entry domain: `sv = (PID>>13)&31` can
 * range 0-31, and slots 24-31 intentionally duplicate 0-7 (verified against the reference
 * implementation, which builds its table this way rather than reducing mod 24).
 */
export const BLOCK_ORDER: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2],
];

export type Gen4Version = 'DP' | 'Pt' | 'HGSS';

export const PARTITION_SIZE = 0x40000;

export interface Gen4Offsets {
  generalSize: number;
  storageSize: number;
  storageStart: number; // offset of storage block within its own partition slot (== generalSize for DP/Pt; HGSS has a gap)
  footerSize: number;
  trainer1: number; // General-block-relative
  party: number;
  boxDataStart: number; // Storage-block-relative offset where box data begins (4 for DP/Pt, 0 for HGSS)
  boxChunkSize: number; // bytes per box (30 * SIZE_4STORED for DP/Pt; padded to 0x1000 for HGSS)
  currentBoxAtEnd: boolean; // HGSS stores CurrentBox after all box data instead of at Storage[0]
  inventory: number; // General-block-relative
  badges16: boolean; // HGSS has a second badge byte (Kanto) at trainer1+0x1F
}

export const OFFSETS: Record<Gen4Version, Gen4Offsets> = {
  DP: {
    generalSize: 0xc100,
    storageSize: 0x121e0,
    storageStart: 0xc100,
    footerSize: 0x14,
    trainer1: 0x64,
    party: 0x98,
    boxDataStart: 4,
    boxChunkSize: BOX_SLOT_COUNT * SIZE_4STORED,
    currentBoxAtEnd: false,
    inventory: 0x624,
    badges16: false,
  },
  Pt: {
    generalSize: 0xcf2c,
    storageSize: 0x121e4,
    storageStart: 0xcf2c,
    footerSize: 0x14,
    trainer1: 0x68,
    party: 0xa0,
    boxDataStart: 4,
    boxChunkSize: BOX_SLOT_COUNT * SIZE_4STORED,
    currentBoxAtEnd: false,
    inventory: 0x630,
    badges16: false,
  },
  HGSS: {
    generalSize: 0xf628,
    storageSize: 0x12310,
    storageStart: 0xf700, // gap of 0xD8 between general block end and storage block start
    footerSize: 0x10,
    trainer1: 0x64,
    party: 0x98,
    boxDataStart: 0,
    boxChunkSize: 0x1000, // each box padded to a full 0x1000 chunk (30*136=4080 used + 16 padding)
    currentBoxAtEnd: true,
    inventory: 0x644,
    badges16: true,
  },
};

export const BOX_NAME_LENGTH_CHARS = 20; // stored as 40 bytes (UTF-16)
