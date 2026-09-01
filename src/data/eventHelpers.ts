import { MOVE_NAMES } from './moveNames';
import { NATURE_NAMES } from './natureNames';

/** Looks up a nature ID by exact display name, for the same reason as `moves()`/`itemId()` below. */
export function natureId(name: string): number {
  const id = NATURE_NAMES.indexOf(name);
  if (id < 0) throw new Error(`Unknown nature name in event data: "${name}"`);
  return id;
}

/** Looks up a held-item ID by exact display name against a given item name table, for the same
 *  reason as `moves()` below: avoids hardcoding a numeric item ID anywhere in event data. */
export function itemId(table: readonly string[], name: string): number {
  const id = table.indexOf(name);
  if (id <= 0) throw new Error(`Unknown item name in event data: "${name}"`);
  return id;
}

/** Looks up up to 4 move names by their exact display name, so event data never hardcodes a
 *  numeric move ID directly (eliminates an entire class of off-by-one transcription risk - see
 *  CLAUDE.md's rule against working from memory for save-affecting facts). Throws at module load
 *  if a name doesn't match, so a typo fails the build/test instead of silently writing move 0. */
export function moves(...names: string[]): [number, number, number, number] {
  const ids = names.map((n) => {
    if (n === '') return 0;
    const id = MOVE_NAMES.indexOf(n);
    if (id <= 0) throw new Error(`Unknown move name in event data: "${n}"`);
    return id;
  });
  while (ids.length < 4) ids.push(0);
  return ids as [number, number, number, number];
}
