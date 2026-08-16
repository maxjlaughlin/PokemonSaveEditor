/** Best-effort guess at which generation a save file belongs to, purely from its byte size, used only for a friendlier error message when full parsing isn't implemented/available yet. */
export function guessGenerationHint(size: number): string {
  switch (size) {
    case 0x8000:
      return 'This looks like it could be a Generation I or II (Game Boy) save. Generation II support is planned but not yet implemented.';
    case 0x10000:
    case 0x20000:
      return 'This looks like it could be a Generation III (Game Boy Advance) save. Support is planned but not yet implemented.';
    case 0x80000:
      return 'This looks like it could be a Generation IV or V (Nintendo DS) save. Support is planned but not yet implemented.';
    default:
      if (size > 0x100000) {
        return 'This looks like a Generation VI+ (3DS/Switch) save. These use console-specific encryption and are not supported yet — editing them incorrectly risks corrupting your save.';
      }
      return 'This file does not match any known Pokémon save file format/size.';
  }
}
