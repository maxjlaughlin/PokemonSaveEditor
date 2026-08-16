import { useState } from 'react';
import type { ItemSlot, SaveFile } from '../../core/types';
import { getItemNames } from '../../data/itemNames';

interface Props {
  save: SaveFile;
  touch: () => void;
}

const BAG_CAPACITY = 20;

function pad(items: ItemSlot[]): ItemSlot[] {
  const out = items.slice(0, BAG_CAPACITY).map((s) => ({ ...s }));
  while (out.length < BAG_CAPACITY) out.push({ item: 0, quantity: 0 });
  return out;
}

export function ItemsTab({ save, touch }: Props) {
  const itemNames = getItemNames(save.generation);
  const [rows, setRows] = useState<ItemSlot[]>(() => pad(save.items));

  const commit = (next: ItemSlot[]) => {
    setRows(next);
    save.items = next.filter((s) => s.item !== 0 && s.quantity > 0);
    touch();
  };

  const updateRow = (i: number, patch: Partial<ItemSlot>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    commit(next);
  };

  return (
    <div className="items-tab">
      <p className="hint">Item bag (max {BAG_CAPACITY} slots). Set item to "(None)" or quantity to 0 to clear a slot.</p>
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
