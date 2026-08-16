import type { ItemSlot } from '../../core/types';

/**
 * Gen1/Gen2 item pouch format: a count byte, then up to `capacity` (item, quantity) byte pairs,
 * terminated by an 0xFF item id sentinel.
 */
export function readGbItemList(bytes: Uint8Array, offset: number, capacity: number): ItemSlot[] {
  const count = Math.min(bytes[offset], capacity);
  const items: ItemSlot[] = [];
  for (let i = 0; i < count; i++) {
    const item = bytes[offset + 1 + i * 2];
    const quantity = bytes[offset + 2 + i * 2];
    if (item === 0xff) break;
    items.push({ item, quantity });
  }
  return items;
}

export function writeGbItemList(bytes: Uint8Array, offset: number, items: ItemSlot[], capacity: number) {
  const trimmed = items.filter((i) => i.item !== 0 && i.quantity > 0).slice(0, capacity);
  bytes[offset] = trimmed.length;
  trimmed.forEach((slot, i) => {
    bytes[offset + 1 + i * 2] = slot.item;
    bytes[offset + 2 + i * 2] = slot.quantity;
  });
  bytes[offset + 1 + trimmed.length * 2] = 0xff;
}
