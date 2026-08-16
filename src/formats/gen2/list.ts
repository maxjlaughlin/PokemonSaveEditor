import type { EditablePokemon } from '../../core/types';
import { readGen2Pokemon, writeGen2Pokemon, emptyGen2Pokemon } from './pokemon';
import { unpackGbList, packGbList, type GbListCodec } from '../shared/gbList';

function codec(bodySize: number): GbListCodec {
  return {
    bodySize,
    speciesToMarker: (speciesId) => (speciesId > 0 && speciesId < 0xff ? speciesId : 0xff),
    readEntity: readGen2Pokemon,
    writeEntity: writeGen2Pokemon,
    emptyEntity: emptyGen2Pokemon,
  };
}

export function unpackGen2List(list: Uint8Array, capacity: number, bodySize: number): EditablePokemon[] {
  return unpackGbList(list, capacity, codec(bodySize));
}

export function packGen2List(pokemon: EditablePokemon[], capacity: number, bodySize: number): Uint8Array {
  return packGbList(pokemon, capacity, codec(bodySize));
}
