// Generation IV/V text encoding: 16-bit code units, terminator 0xFFFF. Unlike Gen1-3's custom 8-bit
// tables, Gen4+ uses a table that is near-identical to Unicode for the Latin/digit/punctuation range
// actually usable for trainer names and nicknames. Full table (incl. Japanese kana and Korean) is not
// reproduced here since this editor targets English/international saves; unmapped code units decode
// to a space rather than truncating the string, since they only appear amid already-Japanese text.

const TERMINATOR = 0xffff;

const RAW: [number, string][] = [
  [0x1de, ' '],
  [0x121, '0'], [0x122, '1'], [0x123, '2'], [0x124, '3'], [0x125, '4'],
  [0x126, '5'], [0x127, '6'], [0x128, '7'], [0x129, '8'], [0x12a, '9'],
  [0x12b, 'A'], [0x12c, 'B'], [0x12d, 'C'], [0x12e, 'D'], [0x12f, 'E'],
  [0x130, 'F'], [0x131, 'G'], [0x132, 'H'], [0x133, 'I'], [0x134, 'J'],
  [0x135, 'K'], [0x136, 'L'], [0x137, 'M'], [0x138, 'N'], [0x139, 'O'],
  [0x13a, 'P'], [0x13b, 'Q'], [0x13c, 'R'], [0x13d, 'S'], [0x13e, 'T'],
  [0x13f, 'U'], [0x140, 'V'], [0x141, 'W'], [0x142, 'X'], [0x143, 'Y'], [0x144, 'Z'],
  [0x145, 'a'], [0x146, 'b'], [0x147, 'c'], [0x148, 'd'], [0x149, 'e'],
  [0x14a, 'f'], [0x14b, 'g'], [0x14c, 'h'], [0x14d, 'i'], [0x14e, 'j'],
  [0x14f, 'k'], [0x150, 'l'], [0x151, 'm'], [0x152, 'n'], [0x153, 'o'],
  [0x154, 'p'], [0x155, 'q'], [0x156, 'r'], [0x157, 's'], [0x158, 't'],
  [0x159, 'u'], [0x15a, 'v'], [0x15b, 'w'], [0x15c, 'x'], [0x15d, 'y'], [0x15e, 'z'],
  [0x1a8, '$'], [0x1a9, '¡'], [0x1aa, '¿'], [0x1ab, '!'], [0x1ac, '?'], [0x1ad, ','], [0x1ae, '.'],
  [0x1af, '･'], [0x1b0, '/'], [0x1b1, '‘'], [0x1b2, "'"], [0x1b3, '“'], [0x1b4, '”'],
  [0x1b9, '('], [0x1ba, ')'], [0x1bd, '+'], [0x1be, '-'], [0x1bf, '*'],
  [0x1c0, '#'], [0x1c1, '='], [0x1c2, '&'], [0x1c3, '~'], [0x1c4, ':'], [0x1c5, ';'],
  [0x1d0, '@'], [0x1d2, '%'],
  [0xee, '♂'], [0xef, '♀'],
];

const CODE_TO_CHAR = new Map<number, string>(RAW);
const CHAR_TO_CODE = new Map<string, number>();
RAW.forEach(([code, ch]) => { if (!CHAR_TO_CODE.has(ch)) CHAR_TO_CODE.set(ch, code); });

export function decodeGen4Text(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const value = bytes[i] | (bytes[i + 1] << 8);
    if (value === TERMINATOR) break;
    out += CODE_TO_CHAR.get(value) ?? ' ';
  }
  return out;
}

export function encodeGen4Text(value: string, charLength: number): Uint8Array {
  const out = new Uint8Array(charLength * 2).fill(0xff);
  let i = 0;
  for (const ch of value) {
    if (i >= charLength) break;
    const code = CHAR_TO_CODE.get(ch);
    if (code === undefined) continue;
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >> 8) & 0xff;
    i++;
  }
  if (i < charLength) {
    out[i * 2] = TERMINATOR & 0xff;
    out[i * 2 + 1] = (TERMINATOR >> 8) & 0xff;
  }
  return out;
}
