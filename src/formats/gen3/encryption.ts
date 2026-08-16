import { BLOCK_ORDER, SIZE_3BLOCK, SIZE_3HEADER } from './constants';

/**
 * Decrypts the 4x12-byte substructure region of a Gen3 Pokemon (bytes 0x20-0x4F) in place, and
 * returns the bytes reordered into canonical logical order [Growth, Attack, EVsCondition, Misc].
 *
 * Gen3 encryption: each 32-bit word of the 48-byte region is XORed with (PID ^ OTID), and the four
 * 12-byte blocks are shuffled into one of 24 physical orders selected by PID % 24.
 */
export function decryptGen3Substructures(data: Uint8Array): Uint8Array {
  const pid = readU32LE(data, 0);
  const otid = readU32LE(data, 4);
  const seed = (pid ^ otid) >>> 0;
  const sv = pid % 24;
  const order = BLOCK_ORDER[sv];

  const physical = data.subarray(SIZE_3HEADER, SIZE_3HEADER + 4 * SIZE_3BLOCK);
  const decryptedPhysical = xorWords(physical, seed);

  const logical = new Uint8Array(4 * SIZE_3BLOCK);
  for (let i = 0; i < 4; i++) {
    const logicalBlock = order[i];
    logical.set(decryptedPhysical.subarray(i * SIZE_3BLOCK, (i + 1) * SIZE_3BLOCK), logicalBlock * SIZE_3BLOCK);
  }
  return logical;
}

/**
 * Encrypts logically-ordered substructure bytes [Growth, Attack, EVsCondition, Misc] back into the
 * physically-shuffled, XOR-encrypted form used at rest, given the (possibly just-edited) PID/OTID.
 */
export function encryptGen3Substructures(logical: Uint8Array, pid: number, otid: number): Uint8Array {
  const seed = (pid ^ otid) >>> 0;
  const sv = pid % 24;
  const order = BLOCK_ORDER[sv];

  const physical = new Uint8Array(4 * SIZE_3BLOCK);
  for (let i = 0; i < 4; i++) {
    const logicalBlock = order[i];
    physical.set(logical.subarray(logicalBlock * SIZE_3BLOCK, (logicalBlock + 1) * SIZE_3BLOCK), i * SIZE_3BLOCK);
  }
  return xorWords(physical, seed);
}

function xorWords(data: Uint8Array, seed: number): Uint8Array {
  const out = new Uint8Array(data.length);
  const view = new DataView(out.buffer);
  const srcView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < data.length; i += 4) {
    view.setUint32(i, (srcView.getUint32(i, true) ^ seed) >>> 0, true);
  }
  return out;
}

function readU32LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

/**
 * 16-bit sum checksum, stored in the plaintext header. Computed over the DECRYPTED, logically-ordered
 * 48-byte substructure region (the game decrypts first, then checksums, to validate decryption succeeded).
 */
export function gen3PokemonChecksum(logicalSubstructureBytes: Uint8Array): number {
  let sum = 0;
  const view = new DataView(logicalSubstructureBytes.buffer, logicalSubstructureBytes.byteOffset, logicalSubstructureBytes.byteLength);
  for (let i = 0; i < logicalSubstructureBytes.length; i += 2) {
    sum = (sum + view.getUint16(i, true)) & 0xffff;
  }
  return sum;
}
