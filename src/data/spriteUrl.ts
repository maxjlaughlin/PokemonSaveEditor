const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/**
 * Official sprite artwork for a species, hotlinked from PokeAPI's public sprite repo (indexed by
 * National Dex ID). The browser fetches this directly at render time - no save data is involved or
 * leaves the browser - but it does mean sprites need an internet connection to display.
 */
export function getSpriteUrl(nationalDexId: number, shiny: boolean): string {
  return `${SPRITE_BASE}/${shiny ? 'shiny/' : ''}${nationalDexId}.png`;
}
