import { useState } from 'react';
import type { SaveFile } from '../../core/types';
import { PokemonSlot } from '../components/PokemonSlot';
import { PokemonEditor } from '../components/PokemonEditor';

interface Props {
  save: SaveFile;
  touch: () => void;
}

export function BoxesTab({ save, touch }: Props) {
  const [boxIndex, setBoxIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const box = save.boxes[boxIndex];

  return (
    <div className="boxes-tab">
      <div className="box-selector">
        <label>
          Box
          <select value={boxIndex} onChange={(e) => { setBoxIndex(Number(e.target.value)); setEditingIndex(null); }}>
            {save.boxes.map((b, i) => (
              <option key={i} value={i}>{b.name}</option>
            ))}
          </select>
        </label>
        <input
          type="text"
          className="box-name"
          value={box.name}
          onChange={(e) => { box.name = e.target.value; touch(); }}
        />
      </div>

      <div className="pokemon-grid box-grid">
        {box.pokemon.map((p, i) => (
          <PokemonSlot key={i} pokemon={p} onClick={() => setEditingIndex(i)} />
        ))}
      </div>

      {editingIndex !== null && (
        <PokemonEditor
          pokemon={box.pokemon[editingIndex]}
          capabilities={save.capabilities}
          onChange={(next) => { box.pokemon[editingIndex] = next; touch(); }}
          onDelete={() => { box.pokemon[editingIndex] = save.createEmptyPokemon(); touch(); setEditingIndex(null); }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
