import { useState } from 'react';
import type { SaveFile } from '../../core/types';
import type { EventDefinition } from '../../core/events';
import { getEventsForSave } from '../../data/events';
import { applyEvent, type ApplyEventResult } from '../../formats/shared/applyEvent';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { MOVE_NAMES } from '../../data/moveNames';
import { getItemNames } from '../../data/itemNames';

interface Props {
  save: SaveFile;
  touch: () => void;
}

export function EventsTab({ save, touch }: Props) {
  const events = getEventsForSave(save);
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null);
  const [result, setResult] = useState<ApplyEventResult | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const itemNames = getItemNames(save.generation);

  const inject = (event: EventDefinition) => {
    const r = applyEvent(save, event);
    setResult(r);
    touch();
  };

  if (events.length === 0) {
    return (
      <div className="events-tab">
        <p className="hint">
          No event data is available yet for this game version. This editor supports a curated set
          of well-documented Generation III/IV distributions and ticket-triggered encounters -
          check back as more are added.
        </p>
      </div>
    );
  }

  return (
    <div className="events-tab">
      <p className="hint">
        Choose a real in-game event to inject. This writes the key item(s) and/or Pokémon it
        grants directly into your save, the same way receiving it in-game would (minus playing
        through the delivery scene) - so you can go trigger and play through the actual event.
      </p>
      <div className="events-layout">
        <ul className="events-list">
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={e.id === selectedId ? 'event-item active' : 'event-item'}
                onClick={() => { setSelectedId(e.id); setResult(null); }}
              >
                {e.name}
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="event-detail">
            <h3>{selected.name}</h3>
            <p>{selected.summary}</p>
            <p className="hint"><strong>How to play it:</strong> {selected.howToPlay}</p>

            {selected.items && selected.items.length > 0 && (
              <div>
                <strong>Grants item(s):</strong>
                <ul>
                  {selected.items.map((i, idx) => (
                    <li key={idx}>{i.itemName}{i.quantity && i.quantity > 1 ? ` x${i.quantity}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            {selected.pokemon && selected.pokemon.length > 0 && (
              <div>
                <strong>Grants Pokémon:</strong>
                <ul>
                  {selected.pokemon.map((p, idx) => (
                    <li key={idx}>
                      Lv.{p.level} {SPECIES_NAMES[p.speciesId] ?? `#${p.speciesId}`}
                      {p.nickname ? ` "${p.nickname}"` : ''} — OT {p.otName}
                      {' — '}{p.moves.filter((m) => m !== 0).map((m) => MOVE_NAMES[m] ?? `#${m}`).join(', ') || 'no moves set'}
                      {p.heldItem ? ` — holding ${itemNames[p.heldItem] ?? `#${p.heldItem}`}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="hint">Source: {selected.source}</p>

            <button type="button" className="primary" onClick={() => inject(selected)}>
              Inject this event
            </button>

            {result && (
              <div className="event-result">
                {result.addedPokemon.length > 0 && <p>Added Pokémon: {result.addedPokemon.join(', ')}</p>}
                {result.addedItems.length > 0 && <p>Added items: {result.addedItems.join(', ')}</p>}
                {result.warnings.length > 0 && (
                  <ul className="event-warnings">
                    {result.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                  </ul>
                )}
                {result.addedPokemon.length === 0 && result.addedItems.length === 0 && result.warnings.length === 0 && (
                  <p>Nothing to add.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
