import type { EditablePokemon } from '../../core/types';

const STRING_BUFFER_LENGTH = 11;

export interface GbListCodec {
  bodySize: number;
  speciesToMarker(speciesId: number): number;
  readEntity(body: Uint8Array, ot: Uint8Array, nickname: Uint8Array): EditablePokemon;
  writeEntity(pokemon: EditablePokemon, body: Uint8Array, ot: Uint8Array, nickname: Uint8Array): void;
  emptyEntity(): EditablePokemon;
}

export function gbListLength(capacity: number, bodySize: number): number {
  return 1 + (capacity + 1) + bodySize * capacity + STRING_BUFFER_LENGTH * capacity * 2;
}

/**
 * Gen1/Gen2 box/party lists are stored compacted: a count byte, a species-marker array (index < count
 * is present), then parallel arrays of Pokemon bodies / OT names / nicknames for the `count` present
 * slots. Reads out into a fixed-size array (padded with empty slots) for the UI.
 */
export function unpackGbList(list: Uint8Array, capacity: number, codec: GbListCodec): EditablePokemon[] {
  const count = Math.min(list[0], capacity);
  const bodyStart = 1 + (capacity + 1);
  const ot1Start = bodyStart + capacity * codec.bodySize;
  const nickStart = ot1Start + capacity * STRING_BUFFER_LENGTH;

  const out: EditablePokemon[] = [];
  for (let i = 0; i < count; i++) {
    const body = list.subarray(bodyStart + i * codec.bodySize, bodyStart + (i + 1) * codec.bodySize);
    const ot = list.subarray(ot1Start + i * STRING_BUFFER_LENGTH, ot1Start + (i + 1) * STRING_BUFFER_LENGTH);
    const nick = list.subarray(nickStart + i * STRING_BUFFER_LENGTH, nickStart + (i + 1) * STRING_BUFFER_LENGTH);
    out.push(codec.readEntity(body, ot, nick));
  }
  while (out.length < capacity) out.push(codec.emptyEntity());
  return out;
}

/** Packs a fixed-size (possibly sparse/empty) array of Pokemon back into a compacted Gen1/2 list buffer. */
export function packGbList(pokemon: EditablePokemon[], capacity: number, codec: GbListCodec): Uint8Array {
  const present = pokemon.filter((p) => !p.isEmpty && p.speciesId !== 0).slice(0, capacity);
  const out = new Uint8Array(gbListLength(capacity, codec.bodySize));
  out[0] = present.length;

  const bodyStart = 1 + (capacity + 1);
  const ot1Start = bodyStart + capacity * codec.bodySize;
  const nickStart = ot1Start + capacity * STRING_BUFFER_LENGTH;

  for (let i = 0; i < capacity; i++) {
    out[1 + i] = i < present.length ? codec.speciesToMarker(present[i].speciesId) : 0xff;
  }
  out[1 + capacity] = 0xff;

  present.forEach((p, i) => {
    const body = out.subarray(bodyStart + i * codec.bodySize, bodyStart + (i + 1) * codec.bodySize);
    const ot = out.subarray(ot1Start + i * STRING_BUFFER_LENGTH, ot1Start + (i + 1) * STRING_BUFFER_LENGTH);
    const nick = out.subarray(nickStart + i * STRING_BUFFER_LENGTH, nickStart + (i + 1) * STRING_BUFFER_LENGTH);
    codec.writeEntity(p, body, ot, nick);
  });

  return out;
}
