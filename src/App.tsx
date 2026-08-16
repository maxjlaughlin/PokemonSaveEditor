import { useCallback, useState } from 'react';
import './App.css';
import type { SaveFile } from './core/types';
import { ImportScreen } from './ui/ImportScreen';
import { EditorApp } from './ui/EditorApp';

function App() {
  const [save, setSave] = useState<SaveFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [revision, setRevision] = useState(0);
  const touch = useCallback(() => setRevision((r) => r + 1), []);

  const handleLoaded = useCallback((loaded: SaveFile, name: string) => {
    setSave(loaded);
    setFileName(name);
    setRevision(0);
  }, []);

  const handleExport = useCallback(() => {
    if (!save) return;
    const bytes = save.toBytes();
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'save.sav';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [save, fileName]);

  const handleClose = useCallback(() => {
    if (!confirm('Close this save file? Any unexported changes will be lost.')) return;
    setSave(null);
    setFileName('');
  }, []);

  if (!save) {
    return <ImportScreen onLoaded={handleLoaded} />;
  }

  return (
    <EditorApp
      save={save}
      fileName={fileName}
      onExport={handleExport}
      onClose={handleClose}
      revision={revision}
      touch={touch}
    />
  );
}

export default App;
