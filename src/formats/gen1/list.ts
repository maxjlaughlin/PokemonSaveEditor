import type { EditablePokemon } from '../../core/types';
import { readGen1Pokemon, writeGen1Pokemon, emptyGen1Pokemon } from './pokemon';
import { GEN1_NATIONAL_TO_INTERNAL } from '../../data/gen1SpeciesMap';
import { unpackGbList, packGbList, type GbListCodec } from '../shared/gbList';

function codec(bodySize: number): GbListCodec {
  return {
    bodySize,
    speciesToMarker: (speciesId) => GEN1_NATIONAL_TO_INTERNAL[speciesId] ?? 0xff,
    readEntity: readGen1Pokemon,
    writeEntity: writeGen1Pokemon,
    emptyEntity: emptyGen1Pokemon,
  };
}

export function unpackGen1List(list: Uint8Array, capacity: number, bodySize: number): EditablePokemon[] {
  return unpackGbList(list, capacity, codec(bodySize));
}

export function packGen1List(pokemon: EditablePokemon[], capacity: number, bodySize: number): Uint8Array {
  return packGbList(pokemon, capacity, codec(bodySize));
}
