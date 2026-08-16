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
  /** Whether HP IV is stored independently (gen3+) vs. derived from the other IVs' low bits (gen1/2). */
  hpIvIndependent: boolean;
  evMax: number; // per-stat max
  natDexMax: number;
  maxMoney: number;
  boxCount: number;
  boxSlotCount: number;
  maxStringLengthTrainer: number;
  maxStringLengthNickname: number;
  badgeCount: number;
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
  natureEditable: boolean;
  ability: number;
  abilitySupported: boolean;
  abilityEditable: boolean;
  gender: 'M' | 'F' | 'U';
  genderEditable: boolean;
  isShiny: boolean;
  shinyEditable: boolean;
  friendship: number;
  /** Whether the Level field is independently stored and thus actually saved when edited (Gen3+
   *  box-stored Pokemon only store Experience; level is derived and not independently editable). */
  levelEditable: boolean;
  /** Raw pass-through fields not surfaced in the UI yet, preserved across edits so exporting an
   *  unrelated change doesn't silently wipe them (Gen2: Pokerus status byte / met-data word.
   *  Gen3+: also bundles PID/secret ID/met-location, since nature/gender/shiny/ability derive from PID). */
  pokerus: number;
  metInfo: number;
  pid: number;
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

/** A named item storage list (Gen1 has one bag + PC; Gen2+ splits into several typed pouches). */
export interface ItemPouch {
  name: string;
  capacity: number;
  items: ItemSlot[];
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
  itemPouches: ItemPouch[];
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
