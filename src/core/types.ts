export type Generation = 1 | 2 | 3 | 4 | 5;

/** Which fields are meaningful for a given generation's Pokemon data. */
export interface GenerationCapabilities {
  generation: Generation;
  hasNature: boolean;
  hasAbility: boolean;
  hasHeldItem: boolean;
  hasGenderField: boolean; // explicit gender byte (gen3+); gen2 derives from IV, gen1 has no gender
  hasPID: boolean;
  ivMax: number; // 15 for gen1/2 (DVs), 31 for gen3+
  evMax: number; // per-stat max
  natDexMax: number;
  maxMoney: number;
  boxCount: number;
  boxSlotCount: number;
  maxStringLengthTrainer: number;
  maxStringLengthNickname: number;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface EditablePokemon {
  isEmpty: boolean;
  /** National Dex ID (0 = none/egg placeholder). */
  speciesId: number;
  nickname: string;
  level: number;
  currentHp: number;
  status: number;
  moves: [number, number, number, number];
  movePp: [number, number, number, number];
  ppUps: [number, number, number, number];
  otName: string;
  otId: number;
  exp: number;
  evs: Stats;
  ivs: Stats;
  item: number;
  heldItemSupported: boolean;
  nature: number;
  natureSupported: boolean;
  ability: number;
  abilitySupported: boolean;
  gender: 'M' | 'F' | 'U';
  genderEditable: boolean;
  isShiny: boolean;
  shinyEditable: boolean;
  friendship: number;
}

export interface Trainer {
  name: string;
  id: number;
  money: number;
  badges: number;
}

export interface ItemSlot {
  item: number;
  quantity: number;
}

export interface EditableBox {
  name: string;
  pokemon: EditablePokemon[];
}

/** Uniform interface every generation's save module implements. */
export interface SaveFile {
  generation: Generation;
  gameTitle: string;
  capabilities: GenerationCapabilities;
  trainer: Trainer;
  party: EditablePokemon[];
  boxes: EditableBox[];
  items: ItemSlot[];
  /** Re-serializes current in-memory state (with edits applied) back to a valid save file, recomputing all checksums. */
  toBytes(): Uint8Array;
  /** A blank/empty Pokemon value appropriate for this generation, used to populate or clear a slot. */
  createEmptyPokemon(): EditablePokemon;
}

export interface SaveFormatModule {
  generation: Generation;
  /** Cheap structural check: does this byte buffer look like this generation's save format? */
  detect(bytes: Uint8Array): boolean;
  load(bytes: Uint8Array, fileName: string): SaveFile;
}
