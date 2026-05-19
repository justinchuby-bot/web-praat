import { useEffect, useRef } from 'react';
import type { ViewRange, TimeSelection } from '../types';
import { xToTime } from '../utils/view';

/**
 * Long-press on touch devices to start a selection, then drag to extend.
 */
export function useTouchSelection(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  viewRange: ViewRange,
  onSelectionChange: (selection: TimeSelection | null) => void,
  enabled = true,
) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelecting = useRef(false);
  const startTime = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const getTime = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return xToTime(clientX - rect.left, rect.width, viewRange);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        clearTimeout(longPressTimer.current!);
        return;
      }
      const touch = e.touches[0];
      const time = getTime(touch.clientX);
      longPressTimer.current = setTimeout(() => {
        isSelecting.current = true;
        startTime.current = time;
        onSelectionChange({ start: time, end: time });
        // Vibrate if available
        navigator.vibrate?.(30);
      }, 500);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (longPressTimer.current && !isSelecting.current) {
        // User moved before long press completed — cancel
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        return;
      }
      if (isSelecting.current && e.touches.length === 1) {
        e.preventDefault();
        const time = getTime(e.touches[0].clientX);
        const start = Math.min(startTime.current, time);
        const end = Math.max(startTime.current, time);
        if (end - start > 0.001) {
          onSelectionChange({ start, end });
        }
      }
    };

    const handleTouchEnd = () => {
      clearTimeout(longPressTimer.current!);
      longPressTimer.current = null;
      isSelecting.current = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [canvasRef, viewRange, onSelectionChange, enabled]);
}
