import type { SaveFile } from '../core/types';
import type { EventDefinition } from '../core/events';
import { EVENTS_GEN3 } from './eventsGen3';
import { EVENTS_GEN4 } from './eventsGen4';

/** Events applicable to the loaded save: right generation, and (when the event is version-specific)
 *  a versionTag match against the save's detected game. */
export function getEventsForSave(save: SaveFile): EventDefinition[] {
  const catalog = save.generation === 3 ? EVENTS_GEN3 : save.generation === 4 ? EVENTS_GEN4 : [];
  return catalog.filter((e) => !save.versionTag || e.versions.includes(save.versionTag));
}
