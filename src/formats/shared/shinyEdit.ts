import type { EditablePokemon, Generation } from '../../core/types';
import { isShinyGen2 } from './dvStats';

/**
 * Picks a new PID that flips shininess (against the given trainer ID / secret ID) while keeping
 * the PID's low byte fixed - Gen3's gender formula reads only that byte, so gender never moves -
 * and searching for a PID whose `% 25` still matches the current nature, since nature is derived
 * from the full PID in both Gen3 and Gen4. Ability is stored independently of PID in this editor's
 * Gen3 model (and always independent in Gen4), so it's unaffected either way. Not handled: Gen3
 * Unown's letter is also PID-derived and could shift as a side effect - a niche enough case to skip.
 */
function regeneratePidForShiny(currentPid: number, tid: number, sid: number, targetNature: number, wantShiny: boolean): number {
  const lowByte = currentPid & 0xff;
  for (let highByte = 0; highByte < 256; highByte++) {
    const pidLow = ((highByte << 8) | lowByte) >>> 0;
    const k = (tid ^ sid ^ pidLow) & 0xffff;
    if (wantShiny) {
      for (let i = 0; i < 8; i++) {
        const pidHigh = (k ^ i) & 0xffff;
        const pid = (pidHigh * 0x10000 + pidLow) >>> 0;
        if (pid % 25 === targetNature) return pid;
      }
    } else {
      for (let offset = 8; offset < 520; offset++) {
        const pidHigh = (k ^ offset) & 0xffff; // offset >= 8 guarantees the XOR result isn't < 8 (not shiny)
        const pid = (pidHigh * 0x10000 + pidLow) >>> 0;
        if (pid % 25 === targetNature) return pid;
      }
    }
  }
  return currentPid; // astronomically unlikely fallback: no candidate matched
}

/**
 * Returns the field patch needed to flip a Pokemon's shininess, using whatever mechanism its
 * generation actually stores shininess with:
 * - Gen2 derives it from specific IVs (Atk/Def/Spe/Special DVs), so this adjusts those - which can
 *   nudge the corresponding stats slightly, same as it would in the original game.
 * - Gen3/Gen4 derive it from the PID vs. trainer ID/secret ID, so this regenerates the PID (see
 *   `regeneratePidForShiny` above for what it does and doesn't preserve).
 * - Gen1 has no shininess mechanic; returns an empty patch.
 */
export function applyShinyToggle(pokemon: EditablePokemon, generation: Generation, shiny: boolean): Partial<EditablePokemon> {
  if (generation === 2) {
    const { atk, def, spe, spa } = pokemon.ivs; // ivs.spa mirrors the Special DV in Gen2
    if (shiny) {
      return { isShiny: true, ivs: { ...pokemon.ivs, atk: atk | 2, def: 10, spe: 10, spa: 10 } };
    }
    if (!isShinyGen2(atk, def, spe, spa)) return { isShiny: false };
    return { isShiny: false, ivs: { ...pokemon.ivs, atk: atk & ~2 } };
  }
  if (generation === 3 || generation === 4) {
    const sid = (pokemon.metInfo >>> 16) & 0xffff;
    const pid = regeneratePidForShiny(pokemon.pid, pokemon.otId & 0xffff, sid, pokemon.nature, shiny);
    return { isShiny: shiny, pid };
  }
  return {};
}
