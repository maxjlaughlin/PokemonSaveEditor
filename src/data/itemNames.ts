import type { Generation } from '../core/types';
import { ITEM_NAMES_GEN1 } from './itemNamesGen1';
import { ITEM_NAMES_GEN2 } from './itemNamesGen2';
import { ITEM_NAMES_GEN3 } from './itemNamesGen3';
import { ITEM_NAMES_MODERN } from './itemNamesModern';

export function getItemNames(generation: Generation): readonly string[] {
  switch (generation) {
    case 1:
      return ITEM_NAMES_GEN1;
    case 2:
      return ITEM_NAMES_GEN2;
    case 3:
      return ITEM_NAMES_GEN3;
    case 4:
    case 5:
      return ITEM_NAMES_MODERN;
    default:
      return ITEM_NAMES_GEN1;
  }
}
