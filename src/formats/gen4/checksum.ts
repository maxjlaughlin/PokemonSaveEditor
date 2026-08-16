/** Gen4/5 save block checksum (CRC-16/CCITT-FALSE variant used by the DS Pokemon games). */
export function crc16ccitt(data: Uint8Array): number {
  let top = 0xff;
  let bot = 0xff;
  for (const b of data) {
    let x = (b ^ top) & 0xff;
    x ^= x >> 4;
    top = (bot ^ (x >> 3) ^ (x << 4)) & 0xff;
    bot = (x ^ (x << 5)) & 0xff;
  }
  return ((top << 8) | bot) & 0xffff;
}
