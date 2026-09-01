// Standard experience-group formulas (identical across all mainline generations; source: the
// well-documented, purely mathematical growth-rate formulas used by the games themselves - see
// Bulbapedia "Experience"). Used to give event Pokemon an Exp value consistent with their level,
// so the game doesn't recompute a jarring level jump the first time they gain experience.
export type GrowthRate = 'erratic' | 'fast' | 'medium-fast' | 'medium-slow' | 'slow' | 'fluctuating';

export function expForLevel(growth: GrowthRate, n: number): number {
  switch (growth) {
    case 'fast':
      return Math.floor((4 * n ** 3) / 5);
    case 'medium-fast':
      return n ** 3;
    case 'medium-slow':
      return Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140);
    case 'slow':
      return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor(n ** 3 * ((Math.floor((n + 1) / 3) + 24) / 50));
      if (n < 36) return Math.floor(n ** 3 * ((n + 14) / 50));
      return Math.floor(n ** 3 * ((Math.floor(n / 2) + 32) / 50));
  }
}
