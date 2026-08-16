import type { SaveFile, SaveFormatModule } from './types';
import { gen1Module } from '../formats/gen1/save';
import { gen2Module } from '../formats/gen2/save';
import { gen3Module } from '../formats/gen3/save';
import { gen4Module } from '../formats/gen4/save';

const MODULES: SaveFormatModule[] = [gen1Module, gen2Module, gen3Module, gen4Module];

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
