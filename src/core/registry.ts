import type { SaveFile, SaveFormatModule } from './types';
import { gen1Module } from '../formats/gen1/save';
import { gen2Module } from '../formats/gen2/save';

const MODULES: SaveFormatModule[] = [gen1Module, gen2Module];

export class UnsupportedSaveError extends Error {
  fileSize: number;
  constructor(fileSize: number) {
    super(`Unrecognized save file (size ${fileSize} bytes). This generation may not be supported yet.`);
    this.fileSize = fileSize;
  }
}

export function detectAndLoad(bytes: Uint8Array, fileName: string): SaveFile {
  for (const mod of MODULES) {
    if (mod.detect(bytes)) return mod.load(bytes, fileName);
  }
  throw new UnsupportedSaveError(bytes.length);
}

export const SUPPORTED_GENERATIONS = MODULES.map((m) => m.generation);
