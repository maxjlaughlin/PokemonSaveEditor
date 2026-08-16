import type { EditablePokemon } from '../../core/types';
import { SPECIES_NAMES } from '../../data/speciesNames';

interface Props {
  pokemon: EditablePokemon;
  onClick: () => void;
}

export function PokemonSlot({ pokemon, onClick }: Props) {
  if (pokemon.isEmpty) {
    return (
      <button type="button" className="pokemon-slot empty" onClick={onClick}>
        <span className="plus">+</span>
      </button>
    );
  }
  const name = pokemon.nickname || SPECIES_NAMES[pokemon.speciesId] || '???';
  return (
    <button type="button" className="pokemon-slot filled" onClick={onClick}>
      <span className="slot-name">{name}</span>
      <span className="slot-level">Lv{pokemon.level}</span>
    </button>
  );
}
