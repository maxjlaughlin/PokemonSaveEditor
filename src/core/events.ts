import type { GrowthRate } from '../formats/shared/expCurve';

/** One Pokemon an event grants, with the specific traits its real-world distribution documents. */
export interface EventPokemonSpec {
  speciesId: number; // National Dex ID
  nickname?: string; // defaults to the species' name, like a normal in-game gift
  level: number;
  growthRate: GrowthRate; // for a level-consistent Exp value, so it doesn't jump levels on its first battle
  moves: [number, number, number, number];
  otName: string;
  otId: number; // TID; almost always the distribution's own fixed OT, not the player's
  otSid?: number; // SID, when the distribution documents one (defaults to 0)
  heldItem?: number;
  nature?: number; // locked nature (PID % 25), when the distribution fixes one; otherwise random
  gender?: 'M' | 'F' | 'U'; // Gen4 only (directly stored there); ignored for Gen3 (PID/ratio-derived)
  ivs?: Partial<{ hp: number; atk: number; def: number; spa: number; spd: number; spe: number }>; // unset = 31 (most events are documented as perfect or near-perfect)
  shiny?: boolean; // default false: virtually all official distributions are shiny-locked off
  friendship?: number; // default 70 (standard base friendship)
  fatefulEncounter?: boolean; // Gen4 only; default true for event Pokemon
}

export interface EventItemGrant {
  itemName: string; // matched by exact name against this generation's item table
  quantity?: number; // default 1
}

export interface EventDefinition {
  id: string;
  generation: 3 | 4;
  name: string;
  /** Which internal game versions this applies to: gen3 'RS'|'E'|'FRLG', gen4 'DP'|'Pt'|'HGSS'. */
  versions: string[];
  summary: string;
  howToPlay: string;
  items?: EventItemGrant[];
  pokemon?: EventPokemonSpec[];
  source: string;
}
