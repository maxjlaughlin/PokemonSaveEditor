import type { EditablePokemon, GenerationCapabilities } from '../../core/types';
import { SPECIES_NAMES } from '../../data/speciesNames';
import { MOVE_NAMES } from '../../data/moveNames';
import { getItemNames } from '../../data/itemNames';
import { NATURE_NAMES } from '../../data/natureNames';
import { ABILITY_NAMES } from '../../data/abilityNames';
import { getSpriteUrl } from '../../data/spriteUrl';
import { applyShinyToggle } from '../../formats/shared/shinyEdit';

interface Props {
  pokemon: EditablePokemon;
  capabilities: GenerationCapabilities;
  onChange: (next: EditablePokemon) => void;
  onClose: () => void;
  onDelete: () => void;
}

const SPECIES_OPTIONS = SPECIES_NAMES
  .map((name, id) => ({ id, name }))
  .filter((s) => s.id > 0);

const MOVE_OPTIONS = MOVE_NAMES.map((name, id) => ({ id, name }));

export function PokemonEditor({ pokemon, capabilities, onChange, onClose, onDelete }: Props) {
  const update = (patch: Partial<EditablePokemon>) => onChange({ ...pokemon, ...patch });
  const updateStat = (group: 'evs' | 'ivs', key: keyof EditablePokemon['evs'], value: number) =>
    onChange({ ...pokemon, [group]: { ...pokemon[group], [key]: value } });

  const maxSpecies = Math.min(capabilities.natDexMax, SPECIES_OPTIONS.length);
  const speciesChoices = SPECIES_OPTIONS.filter((s) => s.id <= maxSpecies);
  const itemNames = getItemNames(capabilities.generation);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pokemon-editor" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="editor-title">
            {!pokemon.isEmpty && (
              <img
                className="editor-sprite"
                src={getSpriteUrl(pokemon.speciesId, pokemon.isShiny)}
                alt=""
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
            )}
            <h2>{pokemon.isEmpty ? 'Empty slot' : `${SPECIES_NAMES[pokemon.speciesId] ?? '???'}`}</h2>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close">×</button>
        </header>

        {pokemon.isEmpty ? (
          <div className="empty-slot-editor">
            <label>
              Add Pokémon (species)
              <select
                value={0}
                onChange={(e) => {
                  const speciesId = Number(e.target.value);
                  if (speciesId === 0) return;
                  update({
                    isEmpty: false,
                    speciesId,
                    level: 5,
                    currentHp: 1,
                    nickname: '',
                    otName: pokemon.otName,
                    otId: pokemon.otId,
                  });
                }}
              >
                <option value={0}>— select a species —</option>
                {speciesChoices.map((s) => (
                  <option key={s.id} value={s.id}>#{String(s.id).padStart(3, '0')} {s.name}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="pokemon-fields">
            <div className="field-grid">
              <label>
                Species
                <select value={pokemon.speciesId} onChange={(e) => update({ speciesId: Number(e.target.value) })}>
                  {speciesChoices.map((s) => (
                    <option key={s.id} value={s.id}>#{String(s.id).padStart(3, '0')} {s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nickname
                <input
                  type="text"
                  value={pokemon.nickname}
                  maxLength={capabilities.maxStringLengthNickname}
                  onChange={(e) => update({ nickname: e.target.value.toUpperCase() })}
                />
              </label>
              <label title={pokemon.levelEditable ? undefined : "This generation doesn't store level independently for boxed Pokémon (only Experience) — edit Experience instead."}>
                Level{!pokemon.levelEditable && ' (not stored for boxed Pokémon)'}
                <input
                  type="number" min={1} max={100} value={pokemon.level} disabled={!pokemon.levelEditable}
                  onChange={(e) => update({ level: clamp(Number(e.target.value), 1, 100) })}
                />
              </label>
              <label>
                Current HP
                <input
                  type="number" min={0} max={999} value={pokemon.currentHp}
                  onChange={(e) => update({ currentHp: clamp(Number(e.target.value), 0, 999) })}
                />
              </label>
              <label>
                OT name
                <input
                  type="text"
                  value={pokemon.otName}
                  maxLength={capabilities.maxStringLengthTrainer}
                  onChange={(e) => update({ otName: e.target.value.toUpperCase() })}
                />
              </label>
              <label>
                OT ID
                <input
                  type="number" min={0} max={65535} value={pokemon.otId}
                  onChange={(e) => update({ otId: clamp(Number(e.target.value), 0, 65535) })}
                />
              </label>
              <label>
                Experience
                <input
                  type="number" min={0} max={16777215} value={pokemon.exp}
                  onChange={(e) => update({ exp: clamp(Number(e.target.value), 0, 16777215) })}
                />
              </label>
              {pokemon.heldItemSupported && (
                <label>
                  Held item
                  <select value={pokemon.item} onChange={(e) => update({ item: Number(e.target.value) })}>
                    {itemNames.map((name, id) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Friendship
                <input
                  type="number" min={0} max={255} value={pokemon.friendship}
                  onChange={(e) => update({ friendship: clamp(Number(e.target.value), 0, 255) })}
                />
              </label>
              {pokemon.natureSupported && (
                pokemon.natureEditable ? (
                  <label>
                    Nature
                    <select value={pokemon.nature} onChange={(e) => update({ nature: Number(e.target.value) })}>
                      {NATURE_NAMES.map((name, id) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label title="Nature is derived from this Pokémon's Personality Value, not independently editable in this editor.">
                    Nature (derived)
                    <input type="text" value={NATURE_NAMES[pokemon.nature] ?? '?'} disabled />
                  </label>
                )
              )}
              {pokemon.abilitySupported && (
                pokemon.abilityEditable ? (
                  <label>
                    Ability
                    <select value={pokemon.ability} onChange={(e) => update({ ability: Number(e.target.value) })}>
                      {ABILITY_NAMES.map((name, id) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label title="Ability is derived from this Pokémon's Personality Value, not independently editable in this editor.">
                    Ability (derived)
                    <input type="text" value={ABILITY_NAMES[pokemon.ability] ?? '?'} disabled />
                  </label>
                )
              )}
              {pokemon.genderEditable ? (
                <label>
                  Gender
                  <select value={pokemon.gender} onChange={(e) => update({ gender: e.target.value as EditablePokemon['gender'] })}>
                    <option value="M">♂ Male</option>
                    <option value="F">♀ Female</option>
                    <option value="U">Genderless</option>
                  </select>
                </label>
              ) : (pokemon.gender === 'M' || pokemon.gender === 'F') && (
                <label title="Gender is derived from IVs/PID in this generation, not stored independently.">
                  Gender (derived)
                  <input type="text" value={pokemon.gender === 'M' ? '♂ Male' : '♀ Female'} disabled />
                </label>
              )}
              {pokemon.shinySupported && (
                pokemon.shinyEditable ? (
                  <label className="shiny-toggle">
                    <input
                      type="checkbox"
                      checked={pokemon.isShiny}
                      onChange={(e) => update(applyShinyToggle(pokemon, capabilities.generation, e.target.checked))}
                    />
                    Shiny ✦
                  </label>
                ) : (
                  <label title="Shininess is derived from IVs in this generation, not stored independently.">
                    Shiny (derived)
                    <input type="text" value={pokemon.isShiny ? 'Yes ✦' : 'No'} disabled />
                  </label>
                )
              )}
            </div>

            <fieldset>
              <legend>Moves</legend>
              <div className="moves-grid">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="move-row">
                    <select
                      value={pokemon.moves[i]}
                      onChange={(e) => {
                        const moves = [...pokemon.moves] as EditablePokemon['moves'];
                        moves[i] = Number(e.target.value);
                        update({ moves });
                      }}
                    >
                      {MOVE_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>{m.name || '(none)'}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={0} max={63} title="PP" value={pokemon.movePp[i]}
                      onChange={(e) => {
                        const movePp = [...pokemon.movePp] as EditablePokemon['movePp'];
                        movePp[i] = clamp(Number(e.target.value), 0, 63);
                        update({ movePp });
                      }}
                    />
                    <input
                      type="number" min={0} max={3} title="PP Ups" value={pokemon.ppUps[i]}
                      onChange={(e) => {
                        const ppUps = [...pokemon.ppUps] as EditablePokemon['ppUps'];
                        ppUps[i] = clamp(Number(e.target.value), 0, 3);
                        update({ ppUps });
                      }}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>IVs (0–{capabilities.ivMax})</legend>
              <div className="stat-grid">
                {capabilities.hpIvIndependent && (
                  <label>
                    HP
                    <input
                      type="number" min={0} max={capabilities.ivMax} value={pokemon.ivs.hp}
                      onChange={(e) => updateStat('ivs', 'hp', clamp(Number(e.target.value), 0, capabilities.ivMax))}
                    />
                  </label>
                )}
                {(['atk', 'def', 'spa', 'spd', 'spe'] as const).map((key) => (
                  <label key={key}>
                    {statLabel(key)}
                    <input
                      type="number" min={0} max={capabilities.ivMax} value={pokemon.ivs[key]}
                      onChange={(e) => updateStat('ivs', key, clamp(Number(e.target.value), 0, capabilities.ivMax))}
                    />
                  </label>
                ))}
                {!capabilities.hpIvIndependent && (
                  <label title="HP IV is derived from the other IVs in this generation, not stored independently.">
                    HP (derived)
                    <input type="number" value={pokemon.ivs.hp} disabled />
                  </label>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend>EVs / Stat Experience (0–{capabilities.evMax})</legend>
              <div className="stat-grid">
                {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map((key) => (
                  <label key={key}>
                    {statLabel(key)}
                    <input
                      type="number" min={0} max={capabilities.evMax} value={pokemon.evs[key]}
                      onChange={(e) => updateStat('evs', key, clamp(Number(e.target.value), 0, capabilities.evMax))}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="button" className="danger" onClick={onDelete}>Remove from this slot</button>
          </div>
        )}
      </div>
    </div>
  );
}

function statLabel(key: string): string {
  return { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }[key] ?? key;
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}
