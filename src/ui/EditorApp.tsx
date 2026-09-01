import { useMemo, useState } from 'react';
import type { SaveFile } from '../core/types';
import { TrainerTab } from './tabs/TrainerTab';
import { PartyTab } from './tabs/PartyTab';
import { BoxesTab } from './tabs/BoxesTab';
import { ItemsTab } from './tabs/ItemsTab';
import { EventsTab } from './tabs/EventsTab';

interface Props {
  save: SaveFile;
  fileName: string;
  onExport: () => void;
  onClose: () => void;
  /** Bump this to force a re-render when in-place mutable edits happen on the SaveFile object. */
  revision: number;
  touch: () => void;
}

type Tab = 'trainer' | 'party' | 'boxes' | 'items' | 'events';

export function EditorApp({ save, fileName, onExport, onClose, touch }: Props) {
  const [tab, setTab] = useState<Tab>('party');

  const tabs = useMemo(
    () => [
      { id: 'trainer' as const, label: 'Trainer' },
      { id: 'party' as const, label: 'Party' },
      { id: 'boxes' as const, label: 'Boxes' },
      { id: 'items' as const, label: 'Items' },
      ...(save.generation === 3 || save.generation === 4 ? [{ id: 'events' as const, label: 'Events' }] : []),
    ],
    [save.generation],
  );

  return (
    <div className="editor-app">
      <header className="editor-header">
        <div>
          <strong>{save.gameTitle}</strong>
          <span className="filename"> — {fileName}</span>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onClose}>Close file</button>
          <button type="button" className="primary" onClick={onExport}>Export save file</button>
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {tab === 'trainer' && <TrainerTab save={save} touch={touch} />}
        {tab === 'party' && <PartyTab save={save} touch={touch} />}
        {tab === 'boxes' && <BoxesTab save={save} touch={touch} />}
        {tab === 'items' && <ItemsTab save={save} touch={touch} />}
        {tab === 'events' && <EventsTab save={save} touch={touch} />}
      </main>
    </div>
  );
}
