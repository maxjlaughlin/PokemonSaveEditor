import type { EditablePokemon } from '../../core/types';
import { readGen1Pokemon, writeGen1Pokemon, emptyGen1Pokemon } from './pokemon';
import { GEN1_NATIONAL_TO_INTERNAL } from '../../data/gen1SpeciesMap';
import { STRING_BUFFER_LENGTH, listLength } from './constants';

/**
 * Gen1 box/party lists are stored compacted: a count byte, a species-marker array (index < count
 * is present), then parallel arrays of Pokemon bodies / OT names / nicknames for the `count`
 * present slots. Reads out into a fixed-size array (padded with empty slots) for the UI.
 */
export function unpackGen1List(list: Uint8Array, capacity: number, bodySize: number): EditablePokemon[] {
  const count = Math.min(list[0], capacity);
  const bodyStart = 1 + (capacity + 1);
  const ot1Start = bodyStart + capacity * bodySize;
  const nickStart = ot1Start + capacity * STRING_BUFFER_LENGTH;

  const out: EditablePokemon[] = [];
  for (let i = 0; i < count; i++) {
    const body = list.subarray(bodyStart + i * bodySize, bodyStart + (i + 1) * bodySize);
    const ot = list.subarray(ot1Start + i * STRING_BUFFER_LENGTH, ot1Start + (i + 1) * STRING_BUFFER_LENGTH);
    const nick = list.subarray(nickStart + i * STRING_BUFFER_LENGTH, nickStart + (i + 1) * STRING_BUFFER_LENGTH);
    out.push(readGen1Pokemon(body, ot, nick));
  }
  while (out.length < capacity) out.push(emptyGen1Pokemon());
  return out;
}

/** Packs a fixed-size (possibly sparse/empty) array of Pokemon back into a compacted Gen1 list buffer. */
export function packGen1List(pokemon: EditablePokemon[], capacity: number, bodySize: number): Uint8Array {
  const present = pokemon.filter((p) => !p.isEmpty && p.speciesId !== 0).slice(0, capacity);
  const out = new Uint8Array(listLength(capacity, bodySize));
  out[0] = present.length;

  const bodyStart = 1 + (capacity + 1);
  const ot1Start = bodyStart + capacity * bodySize;
  const nickStart = ot1Start + capacity * STRING_BUFFER_LENGTH;

  for (let i = 0; i < capacity; i++) {
    out[1 + i] = i < present.length ? (GEN1_NATIONAL_TO_INTERNAL[present[i].speciesId] ?? 0xff) : 0xff;
  }
  out[1 + capacity] = 0xff;

  present.forEach((p, i) => {
    const body = out.subarray(bodyStart + i * bodySize, bodyStart + (i + 1) * bodySize);
    const ot = out.subarray(ot1Start + i * STRING_BUFFER_LENGTH, ot1Start + (i + 1) * STRING_BUFFER_LENGTH);
    const nick = out.subarray(nickStart + i * STRING_BUFFER_LENGTH, nickStart + (i + 1) * STRING_BUFFER_LENGTH);
    writeGen1Pokemon(p, body, ot, nick);
  });

  return out;
}
