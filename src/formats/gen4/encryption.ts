import { BLOCK_ORDER, SIZE_4BLOCK, SIZE_4HEADER, SIZE_4STORED } from './constants';

/**
 * Gen4/5 stream cipher: a 16-bit LCG advances per word, XORing each word with the LCG's upper 16
 * bits. This is its own inverse (the seed sequence depends only on the starting seed, not the data),
 * so the same function encrypts and decrypts.
 */
function cryptWords(data: Uint8Array, seed: number): Uint8Array {
  const out = new Uint8Array(data.length);
  let s = seed >>> 0;
  for (let i = 0; i < data.length; i += 2) {
    s = (Math.imul(0x41c64e6d, s) + 0x6073) >>> 0;
    const xor = (s >>> 16) & 0xffff;
    const word = (data[i] | (data[i + 1] << 8)) ^ xor;
    out[i] = word & 0xff;
    out[i + 1] = (word >> 8) & 0xff;
  }
  return out;
}

function reorderBlocks(input: Uint8Array, order: readonly [number, number, number, number], toLogical: boolean): Uint8Array {
  const out = new Uint8Array(4 * SIZE_4BLOCK);
  for (let i = 0; i < 4; i++) {
    const logicalBlock = order[i];
    const src = toLogical ? i : logicalBlock;
    const dst = toLogical ? logicalBlock : i;
    out.set(input.subarray(src * SIZE_4BLOCK, (src + 1) * SIZE_4BLOCK), dst * SIZE_4BLOCK);
  }
  return out;
}

/** Decrypts a full 136/236-byte Gen4 Pokemon slot, returning [logicalMainBlocks(128B), decryptedPartyStats|null]. */
export function decryptGen4(raw: Uint8Array): { logical: Uint8Array; partyStats: Uint8Array | null } {
  const pid = readU32LE(raw, 0);
  const checksum = raw[6] | (raw[7] << 8);
  const sv = (pid >>> 13) & 31;
  const order = BLOCK_ORDER[sv];

  const physical = raw.subarray(SIZE_4HEADER, SIZE_4STORED);
  const decryptedPhysical = cryptWords(physical, checksum);
  const logical = reorderBlocks(decryptedPhysical, order, true);

  let partyStats: Uint8Array | null = null;
  if (raw.length > SIZE_4STORED) {
    partyStats = cryptWords(raw.subarray(SIZE_4STORED), pid);
  }
  return { logical, partyStats };
}

/** Encrypts logical (0-3 block order) bytes + optional party stats back into a raw Gen4 slot. */
export function encryptGen4(pid: number, checksum: number, logical: Uint8Array, partyStats: Uint8Array | null, outLength: number): Uint8Array {
  const sv = (pid >>> 13) & 31;
  const order = BLOCK_ORDER[sv];
  const physical = reorderBlocks(logical, order, false);
  const encryptedPhysical = cryptWords(physical, checksum);

  const out = new Uint8Array(outLength);
  writeU32LE(out, 0, pid);
  out[6] = checksum & 0xff;
  out[7] = (checksum >> 8) & 0xff;
  out.set(encryptedPhysical, SIZE_4HEADER);
  if (partyStats && outLength > SIZE_4STORED) {
    out.set(cryptWords(partyStats, pid), SIZE_4STORED);
  }
  return out;
}

export function gen4PokemonChecksum(logicalBlocks: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < logicalBlocks.length; i += 2) {
    sum = (sum + (logicalBlocks[i] | (logicalBlocks[i + 1] << 8))) & 0xffff;
  }
  return sum;
}

function readU32LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
function writeU32LE(b: Uint8Array, o: number, v: number) {
  b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff;
}
