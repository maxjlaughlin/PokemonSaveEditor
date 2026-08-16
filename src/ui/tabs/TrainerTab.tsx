import type { SaveFile } from '../../core/types';

interface Props {
  save: SaveFile;
  touch: () => void;
}

export function TrainerTab({ save, touch }: Props) {
  const { trainer, capabilities } = save;

  return (
    <div className="trainer-tab">
      <div className="field-grid">
        <label>
          Trainer name
          <input
            type="text"
            value={trainer.name}
            maxLength={capabilities.maxStringLengthTrainer}
            onChange={(e) => { trainer.name = e.target.value.toUpperCase(); touch(); }}
          />
        </label>
        <label>
          Trainer ID
          <input
            type="number"
            min={0}
            max={65535}
            value={trainer.id}
            onChange={(e) => { trainer.id = clamp(Number(e.target.value), 0, 65535); touch(); }}
          />
        </label>
        <label>
          Money
          <input
            type="number"
            min={0}
            max={capabilities.maxMoney}
            value={trainer.money}
            onChange={(e) => { trainer.money = clamp(Number(e.target.value), 0, capabilities.maxMoney); touch(); }}
          />
        </label>
      </div>

      <fieldset>
        <legend>Badges</legend>
        <div className="badge-grid">
          {Array.from({ length: capabilities.badgeCount }, (_, i) => (
            <label key={i} className="badge-checkbox">
              <input
                type="checkbox"
                checked={(trainer.badges & (1 << i)) !== 0}
                onChange={(e) => {
                  trainer.badges = e.target.checked ? trainer.badges | (1 << i) : trainer.badges & ~(1 << i);
                  touch();
                }}
              />
              {badgeLabel(i, capabilities.badgeCount)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function badgeLabel(i: number, total: number): string {
  if (total === 16) return i < 8 ? `Johto Badge ${i + 1}` : `Kanto Badge ${i - 7}`;
  return `Badge ${i + 1}`;
}
