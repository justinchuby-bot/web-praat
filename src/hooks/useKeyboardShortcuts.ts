import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onPlayPause: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onMoveSelectionLeft: () => void;
  onMoveSelectionRight: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
}

/**
 * Global keyboard shortcuts for the audio editor.
 *
 * Space = play/pause
 * Cmd/Ctrl+Z = undo
 * Cmd/Ctrl+Shift+Z = redo
 * Cmd/Ctrl+X = cut
 * Cmd/Ctrl+C = copy
 * Cmd/Ctrl+V = paste
 * Delete/Backspace = delete selection
 * Cmd/Ctrl+A = select all
 * ArrowLeft = move selection left
 * ArrowRight = move selection right
 * Cmd/Ctrl+= / Cmd/Ctrl++ = zoom in
 * Cmd/Ctrl+- = zoom out
 * Cmd/Ctrl+0 = fit to window
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (e.code === 'Space') {
        e.preventDefault();
        handlers.onPlayPause();
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handlers.onRedo();
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handlers.onUndo();
        return;
      }

      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handlers.onCut();
        return;
      }

      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handlers.onCopy();
        return;
      }

      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlers.onPaste();
        return;
      }

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handlers.onSelectAll();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handlers.onDelete();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlers.onMoveSelectionLeft();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlers.onMoveSelectionRight();
        return;
      }

      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handlers.onZoomIn();
        return;
      }

      if (mod && e.key === '-') {
        e.preventDefault();
        handlers.onZoomOut();
        return;
      }

      if (mod && e.key === '0') {
        e.preventDefault();
        handlers.onFitToWindow();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}
