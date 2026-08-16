/** Gen1/2 store money as 3 bytes of binary-coded decimal (2 decimal digits per byte). */
export function readBcdMoney(bytes: Uint8Array, offset: number, byteCount = 3): number {
  let money = 0;
  for (let i = 0; i < byteCount; i++) {
    const byte = bytes[offset + i];
    money = money * 100 + ((byte >> 4) & 0xf) * 10 + (byte & 0xf);
  }
  return money;
}

export function writeBcdMoney(bytes: Uint8Array, offset: number, value: number, byteCount = 3, max = 999999) {
  let v = Math.max(0, Math.min(max, Math.floor(value)));
  for (let i = byteCount - 1; i >= 0; i--) {
    const digits = v % 100;
    v = Math.floor(v / 100);
    bytes[offset + i] = ((Math.floor(digits / 10) & 0xf) << 4) | (digits % 10);
  }
}
