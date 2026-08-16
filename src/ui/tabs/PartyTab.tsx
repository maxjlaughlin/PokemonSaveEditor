import { useState } from 'react';
import type { SaveFile } from '../../core/types';
import { PokemonSlot } from '../components/PokemonSlot';
import { PokemonEditor } from '../components/PokemonEditor';

interface Props {
  save: SaveFile;
  touch: () => void;
}

export function PartyTab({ save, touch }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <div className="party-tab">
      <p className="hint">Your active team (up to 6 Pokémon). Click a slot to edit or add a Pokémon.</p>
      <div className="pokemon-grid party-grid">
        {save.party.map((p, i) => (
          <PokemonSlot key={i} pokemon={p} onClick={() => setEditingIndex(i)} />
        ))}
      </div>

      {editingIndex !== null && (
        <PokemonEditor
          pokemon={save.party[editingIndex]}
          capabilities={save.capabilities}
          onChange={(next) => { save.party[editingIndex] = next; touch(); }}
          onDelete={() => { save.party[editingIndex] = save.createEmptyPokemon(); touch(); setEditingIndex(null); }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
