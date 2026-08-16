import type { Generation } from '../core/types';
import { ITEM_NAMES_GEN1 } from './itemNamesGen1';
import { ITEM_NAMES_GEN2 } from './itemNamesGen2';

export function getItemNames(generation: Generation): readonly string[] {
  switch (generation) {
    case 1:
      return ITEM_NAMES_GEN1;
    case 2:
      return ITEM_NAMES_GEN2;
    default:
      return ITEM_NAMES_GEN1;
  }
}
