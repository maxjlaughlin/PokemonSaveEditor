import { useCallback, useRef, useState } from 'react';
import { detectAndLoad, UnsupportedSaveError, SUPPORTED_GENERATIONS } from '../core/registry';
import { guessGenerationHint } from '../core/sizeHints';
import type { SaveFile } from '../core/types';

interface Props {
  onLoaded: (save: SaveFile, fileName: string) => void;
}

export function ImportScreen({ onLoaded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    file.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      try {
        const save = detectAndLoad(bytes, file.name);
        onLoaded(save, file.name);
      } catch (e) {
        if (e instanceof UnsupportedSaveError) {
          setError(guessGenerationHint(e.fileSize));
        } else {
          setError(e instanceof Error ? e.message : 'Failed to read save file.');
        }
      }
    });
  }, [onLoaded]);

  return (
    <div className="import-screen">
      <h1>Pokémon Save Editor</h1>
      <p className="subtitle">Runs entirely in your browser — your save file is never uploaded anywhere.</p>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <p>Drop your save file here, or click to choose one</p>
        <p className="hint">.sav files</p>
        <input
          ref={inputRef}
          type="file"
          accept=".sav,.dat,.srm"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="support-status">
        <h2>Generation support</h2>
        <ul>
          <li className={SUPPORTED_GENERATIONS.includes(1) ? 'supported' : 'unsupported'}>
            Gen I — Red / Blue / Yellow {SUPPORTED_GENERATIONS.includes(1) ? '✓' : '(planned)'}
          </li>
          <li className={SUPPORTED_GENERATIONS.includes(2) ? 'supported' : 'unsupported'}>
            Gen II — Gold / Silver / Crystal {SUPPORTED_GENERATIONS.includes(2) ? '✓' : '(planned)'}
          </li>
          <li className="unsupported">Gen III — Ruby / Sapphire / Emerald / FireRed / LeafGreen (planned)</li>
          <li className="unsupported">Gen IV — Diamond / Pearl / Platinum / HeartGold / SoulSilver (planned)</li>
          <li className="unsupported">Gen V — Black / White / Black 2 / White 2 (planned)</li>
          <li className="unsupported">Gen VI+ — 3DS / Switch titles use console-specific encryption; not currently planned</li>
        </ul>
      </div>

      <div className="safety-note">
        <strong>Always keep a backup of your original save file</strong> before importing it here, in case of unexpected data loss.
      </div>
    </div>
  );
}
