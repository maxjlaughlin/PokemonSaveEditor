// Generates a Personality Value for a freshly-constructed event Pokemon, satisfying the
// shininess/nature constraints an official distribution documents. Unlike `shinyEdit.ts` (which
// must preserve an *existing* Pokemon's other PID-derived traits while flipping one bit of state),
// this has no prior PID to preserve anything from, so plain rejection sampling against the same
// shininess formula used everywhere else in this codebase is simpler and just as correct: a
// non-shiny match is >99.98% likely on the first draw, and a specific nature (if the distribution
// locks one) is a 1-in-25 draw on top of that - trivially fast either way.
export function generateEventPid(tid: number, sid: number, opts: { shiny?: boolean; nature?: number } = {}): number {
  for (let attempt = 0; attempt < 1_000_000; attempt++) {
    const pid = (Math.random() * 0x100000000) >>> 0;
    if (opts.shiny !== undefined) {
      const isShiny = ((tid ^ sid ^ (pid & 0xffff) ^ (pid >>> 16)) & 0xffff) < 8;
      if (isShiny !== opts.shiny) continue;
    }
    if (opts.nature !== undefined && pid % 25 !== opts.nature) continue;
    return pid;
  }
  throw new Error('Could not generate a PID satisfying event constraints');
}
