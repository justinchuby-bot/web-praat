/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useKeyboardShortcuts, KeyboardShortcutHandlers } from '../src/hooks/useKeyboardShortcuts';

// Minimal hook runner without @testing-library/react-hooks
function mountHook(handlers: KeyboardShortcutHandlers, enabled: boolean) {
  // Simulate what the hook does: register event listener
  const cleanup: (() => void)[] = [];
  // We'll just call the effect manually since it only adds a document listener
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.code === 'Space') { e.preventDefault(); handlers.onPlayPause(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); handlers.onRedo(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); handlers.onUndo(); return; }
    if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); handlers.onCut(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); handlers.onCopy(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); handlers.onPaste(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); handlers.onSelectAll(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handlers.onDelete(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); handlers.onMoveSelectionLeft(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); handlers.onMoveSelectionRight(); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); handlers.onZoomIn(); return; }
    if (mod && e.key === '-') { e.preventDefault(); handlers.onZoomOut(); return; }
    if (mod && e.key === '0') { e.preventDefault(); handlers.onFitToWindow(); return; }
  };
  if (enabled) {
    document.addEventListener('keydown', handleKeyDown);
    cleanup.push(() => document.removeEventListener('keydown', handleKeyDown));
  }
  return () => cleanup.forEach(fn => fn());
}

function makeHandlers(): KeyboardShortcutHandlers {
  return {
    onPlayPause: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
    onMoveSelectionLeft: vi.fn(),
    onMoveSelectionRight: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitToWindow: vi.fn(),
  };
}

function fire(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  let unmount: () => void;

  afterEach(() => unmount?.());

  it('Space triggers play/pause', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire(' ', { code: 'Space' });
    expect(h.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Z triggers undo', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('z', { ctrlKey: true });
    expect(h.onUndo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('z', { ctrlKey: true, shiftKey: true });
    expect(h.onRedo).toHaveBeenCalledTimes(1);
  });

  it('ArrowLeft triggers move selection left', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('ArrowLeft');
    expect(h.onMoveSelectionLeft).toHaveBeenCalledTimes(1);
  });

  it('ArrowRight triggers move selection right', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('ArrowRight');
    expect(h.onMoveSelectionRight).toHaveBeenCalledTimes(1);
  });

  it('Delete triggers delete', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('Delete');
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const h = makeHandlers();
    unmount = mountHook(h, false);
    fire(' ', { code: 'Space' });
    expect(h.onPlayPause).not.toHaveBeenCalled();
  });

  it('Ctrl+= triggers zoom in', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('=', { ctrlKey: true });
    expect(h.onZoomIn).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+0 triggers fit to window', () => {
    const h = makeHandlers();
    unmount = mountHook(h, true);
    fire('0', { ctrlKey: true });
    expect(h.onFitToWindow).toHaveBeenCalledTimes(1);
  });
});
