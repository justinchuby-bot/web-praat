import { useCallback, useEffect, useState } from 'react';

interface ShortcutEntry {
  keys: string;
  description: string;
}

const shortcuts: ShortcutEntry[] = [
  { keys: 'Space', description: 'Play / Pause' },
  { keys: '⌘/Ctrl + Z', description: 'Undo' },
  { keys: '⌘/Ctrl + Shift + Z', description: 'Redo' },
  { keys: '⌘/Ctrl + X', description: 'Cut selection' },
  { keys: '⌘/Ctrl + C', description: 'Copy selection' },
  { keys: '⌘/Ctrl + V', description: 'Paste' },
  { keys: 'Delete / Backspace', description: 'Delete selection' },
  { keys: '⌘/Ctrl + A', description: 'Select all' },
  { keys: '← / →', description: 'Move selection / pan' },
  { keys: '+ / =', description: 'Zoom in' },
  { keys: '- / _', description: 'Zoom out' },
  { keys: '0', description: 'Fit to window' },
  { keys: '?', description: 'Show this help' },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
      // Don't trigger in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      event.preventDefault();
      setOpen((v) => !v);
    }
    if (event.key === 'Escape' && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
    >
      <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button
            className="shortcuts-close"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts dialog"
          >
            ×
          </button>
        </div>
        <div className="shortcuts-list" role="list">
          {shortcuts.map((s) => (
            <div key={s.keys} className="shortcut-row" role="listitem">
              <kbd className="shortcut-keys">{s.keys}</kbd>
              <span className="shortcut-desc">{s.description}</span>
            </div>
          ))}
        </div>
        <p className="shortcuts-hint">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p>
      </div>
    </div>
  );
}
