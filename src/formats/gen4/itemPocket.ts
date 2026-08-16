import type { ItemSlot } from '../../core/types';

/**
 * Gen4 item pockets are fixed-position tables: slot i always corresponds to `whitelist[i]`, and only
 * the quantity is stored per-slot (4 bytes: u16 item id + u16 quantity, id is redundant with position
 * but stored anyway and trusted on read for robustness).
 */
export function readGen4ItemPocket(bytes: Uint8Array, offset: number, whitelist: readonly number[]): ItemSlot[] {
  const items: ItemSlot[] = [];
  for (let i = 0; i < whitelist.length; i++) {
    const o = offset + i * 4;
    const quantity = bytes[o + 2] | (bytes[o + 3] << 8);
    if (quantity > 0) items.push({ item: whitelist[i], quantity });
  }
  return items;
}

export function writeGen4ItemPocket(bytes: Uint8Array, offset: number, whitelist: readonly number[], items: ItemSlot[]) {
  const indexByItem = new Map<number, number>();
  whitelist.forEach((id, idx) => indexByItem.set(id, idx));

  for (let i = 0; i < whitelist.length; i++) {
    const o = offset + i * 4;
    bytes[o] = whitelist[i] & 0xff;
    bytes[o + 1] = (whitelist[i] >> 8) & 0xff;
    bytes[o + 2] = 0;
    bytes[o + 3] = 0;
  }
  for (const slot of items) {
    if (slot.item === 0 || slot.quantity <= 0) continue;
    const idx = indexByItem.get(slot.item);
    if (idx === undefined) continue; // item not valid for this pocket
    const o = offset + idx * 4;
    const qty = Math.min(slot.quantity, 0xffff);
    bytes[o + 2] = qty & 0xff;
    bytes[o + 3] = (qty >> 8) & 0xff;
  }
}
