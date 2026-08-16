// Generation I/II (RBY) text encoding. Gen 1 games use a custom character map, not ASCII.
// English table verified against community-documented Gen I character maps.

const TERMINATOR = 0x50;
const TRADE_OT_CODE = 0x5d;
const TRADE_OT = '*';

// Index = byte value, value = character. '\0' marks unused/terminator codes.
const TABLE_EN: string[] = new Array(256).fill('\0');

function set(from: number, to: number, chars: string) {
  if (chars.length !== to - from + 1) throw new Error(`char table range ${from.toString(16)}-${to.toString(16)} length mismatch`);
  for (let i = 0; i < chars.length; i++) TABLE_EN[from + i] = chars[i];
}

set(0x80, 0x99, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // 0x80-0x99
TABLE_EN[0x9a] = '(';
TABLE_EN[0x9b] = ')';
TABLE_EN[0x9c] = ':';
TABLE_EN[0x9d] = ';';
TABLE_EN[0x9e] = '[';
TABLE_EN[0x9f] = ']';
set(0xa0, 0xb9, 'abcdefghijklmnopqrstuvwxyz'); // 0xA0-0xB9
TABLE_EN[0xba] = 'à';
TABLE_EN[0xbb] = 'è';
TABLE_EN[0xbc] = 'é';
TABLE_EN[0xbd] = 'ù';
TABLE_EN[0xbe] = 'À';
TABLE_EN[0xbf] = 'Á';
const c0map = ['Ä', 'Ö', 'Ü', 'ä', 'ö', 'ü', 'È', 'É', 'Ì', 'Í', 'Ñ', 'Ò', 'Ó', 'Ù', 'Ú', 'á'];
set(0xc0, 0xcf, c0map.join(''));
const d0map = ['ì', 'í', 'ñ', 'ò', 'ó', 'ú', 'º', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '←', "'"];
d0map.forEach((c, i) => { TABLE_EN[0xd0 + i] = c; });
const e0map = ['’', '{', '}', '-', '\0', '\0', '?', '!', '․', '&', '%', '→', '▷', '▶', '▼', '♂'];
e0map.forEach((c, i) => { TABLE_EN[0xe0 + i] = c; });
const f0map = ['¥', '×', '.', '/', ',', '♀', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
f0map.forEach((c, i) => { TABLE_EN[0xf0 + i] = c; });
TABLE_EN[0x7f] = ' '; // half-width space
TABLE_EN[0x71] = '@'; // Po
TABLE_EN[0x72] = '#'; // Ke
TABLE_EN[0x74] = '“';
TABLE_EN[0x75] = '”';
TABLE_EN[0x77] = '…';

const CHAR_TO_BYTE_EN = new Map<string, number>();
TABLE_EN.forEach((c, i) => {
  if (c !== '\0' && !CHAR_TO_BYTE_EN.has(c)) CHAR_TO_BYTE_EN.set(c, i);
});

/** Decode Gen 1 (English/international) encoded bytes to a JS string. */
export function decodeGen1Text(bytes: Uint8Array): string {
  if (bytes.length > 0 && bytes[0] === TRADE_OT_CODE) return TRADE_OT;
  let out = '';
  for (const b of bytes) {
    if (b === TERMINATOR || b === 0x00) break;
    const c = TABLE_EN[b];
    if (c === '\0') break;
    out += c;
  }
  return out;
}

/** Encode a JS string to Gen 1 (English/international) bytes, padded/terminated to length. */
export function encodeGen1Text(value: string, length: number): Uint8Array {
  const out = new Uint8Array(length).fill(TERMINATOR);
  if (value === TRADE_OT) {
    out[0] = TRADE_OT_CODE;
    out[1] = TERMINATOR;
    return out;
  }
  let i = 0;
  for (const ch of value) {
    if (i >= length) break;
    const code = CHAR_TO_BYTE_EN.get(ch);
    if (code === undefined) continue;
    out[i++] = code;
  }
  if (i < length) out[i] = TERMINATOR;
  return out;
}
