import { useState } from 'react';
import type { ItemSlot, SaveFile } from '../../core/types';
import { getItemNames } from '../../data/itemNames';

interface Props {
  save: SaveFile;
  touch: () => void;
}

function pad(items: ItemSlot[], capacity: number): ItemSlot[] {
  const out = items.slice(0, capacity).map((s) => ({ ...s }));
  while (out.length < capacity) out.push({ item: 0, quantity: 0 });
  return out;
}

export function ItemsTab({ save, touch }: Props) {
  const itemNames = getItemNames(save.generation);
  const [pouchIndex, setPouchIndex] = useState(0);
  const pouch = save.itemPouches[pouchIndex];
  const [rows, setRows] = useState<ItemSlot[]>(() => pad(pouch.items, pouch.capacity));

  const selectPouch = (i: number) => {
    setPouchIndex(i);
    setRows(pad(save.itemPouches[i].items, save.itemPouches[i].capacity));
  };

  const commit = (next: ItemSlot[]) => {
    setRows(next);
    pouch.items = next.filter((s) => s.item !== 0 && s.quantity > 0);
    touch();
  };

  const updateRow = (i: number, patch: Partial<ItemSlot>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    commit(next);
  };

  return (
    <div className="items-tab">
      {save.itemPouches.length > 1 && (
        <div className="box-selector">
          <label>
            Pouch
            <select value={pouchIndex} onChange={(e) => selectPouch(Number(e.target.value))}>
              {save.itemPouches.map((p, i) => (
                <option key={i} value={i}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="hint">{pouch.name} (max {pouch.capacity} slots). Set item to "(None)" or quantity to 0 to clear a slot.</p>
      <table className="items-table">
        <thead>
          <tr><th>#</th><th>Item</th><th>Quantity</th></tr>
        </thead>
        <tbody>
          {rows.map((slot, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <select
                  value={slot.item}
                  onChange={(e) => {
                    const item = Number(e.target.value);
                    updateRow(i, { item, quantity: item === 0 ? 0 : slot.quantity || 1 });
                  }}
                >
                  {itemNames.map((name, id) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number" min={0} max={99} value={slot.quantity}
                  onChange={(e) => updateRow(i, { quantity: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
