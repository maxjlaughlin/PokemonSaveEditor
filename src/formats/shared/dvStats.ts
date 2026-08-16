/** Gen1/Gen2 stat formula from DVs (0-15) and Stat Experience (0-65535). Identical across both generations. */
export function calcDvStat(base: number, dv: number, statExp: number, level: number, isHp: boolean): number {
  const evBonus = Math.floor(Math.sqrt(Math.min(statExp, 65535)) / 4);
  const core = Math.floor(((base + dv) * 2 + evBonus) * level / 100);
  return isHp ? core + level + 10 : core + 5;
}

export function packDvs(atk: number, def: number, spe: number, spc: number): [number, number] {
  return [((atk & 0xf) << 4) | (def & 0xf), ((spe & 0xf) << 4) | (spc & 0xf)];
}

export function unpackDvs(b0: number, b1: number) {
  return { atk: (b0 >> 4) & 0xf, def: b0 & 0xf, spe: (b1 >> 4) & 0xf, spc: b1 & 0xf };
}

/** HP DV/IV is never stored independently in Gen1/2 - it's derived from the low bit of each other DV. */
export function hpDvFrom(atk: number, def: number, spe: number, spc: number): number {
  return ((atk & 1) << 3) | ((def & 1) << 2) | ((spe & 1) << 1) | (spc & 1);
}

/** Gen2 gender from Attack DV and the species' gender ratio byte (0=male-only .. 254=female-only, 255=genderless). */
export function genderFromAtkDv(genderRatio: number, atkDv: number): 'M' | 'F' | 'U' {
  if (genderRatio === 255) return 'U';
  const threshold = Math.round(genderRatio / 16);
  return atkDv < threshold ? 'F' : 'M';
}

/** Gen2 shiny: DEF/SPE/SPC DVs must be 10, and ATK DV must have its 0x2 bit set. */
export function isShinyGen2(atk: number, def: number, spe: number, spc: number): boolean {
  return def === 10 && spe === 10 && spc === 10 && (atk & 2) !== 0;
}
