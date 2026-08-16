/** Modern (Gen3+) IV(0-31)/EV(0-255)/nature stat formula. */

/** Nature modifier for stat index 0=Atk,1=Def,2=Spe,3=SpA,4=SpD. */
export function natureMod(nature: number, statIndex: number): number {
  const row = Math.floor(nature / 5);
  const col = nature % 5;
  if (row === col) return 1;
  if (statIndex === row) return 1.1;
  if (statIndex === col) return 0.9;
  return 1;
}

export function calcModernStat(base: number, iv: number, ev: number, level: number, isHp: boolean, mod = 1): number {
  const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
  return isHp ? core + level + 10 : Math.floor((core + 5) * mod);
}
