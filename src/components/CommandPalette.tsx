import { useState, useEffect, useRef, useCallback } from 'react';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

function fuzzyMatch(query: string, label: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const target = label.toLowerCase();
  return words.every((w) => target.includes(w));
}

export function CommandPalette({ commands, open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) => fuzzyMatch(query, `${cmd.category} ${cmd.label}`));

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          className="command-palette-input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="command-palette-list" ref={listRef}>
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-palette-item${i === selectedIndex ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => {
                cmd.action();
                onClose();
              }}
            >
              <span className="command-palette-label">
                <span className="command-palette-category">{cmd.category}:</span> {cmd.label}
              </span>
              {cmd.shortcut && <span className="command-palette-shortcut">{cmd.shortcut}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div className="command-palette-empty">No matching commands</div>}
        </div>
      </div>
    </div>
  );
}
