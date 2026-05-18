import { useCallback, useEffect, useRef } from 'react';
import type { ViewRange } from '../types';
import { xToTime } from '../utils/view';

export interface ZoomPanCallbacks {
  onWheelZoom: (pivotTime: number, zoomFactor: number) => void;
  onPan: (deltaTime: number) => void;
}

/**
 * Hook to attach enhanced zoom/pan interactions to a canvas element:
 * - Ctrl+wheel / pinch: zoom at cursor
 * - Shift+wheel / horizontal scroll (trackpad): pan
 * - Plain wheel (vertical): zoom (existing behavior)
 * - Touch pinch: zoom
 * - Touch pan (two fingers): pan
 * - Double-click: zoom in 2× at point
 */
export function useZoomPan(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  viewRange: ViewRange,
  callbacks: ZoomPanCallbacks,
  enabled = true,
) {
  const viewRangeRef = useRef(viewRange);
  viewRangeRef.current = viewRange;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Touch state
  const touchDistRef = useRef(0);
  const touchCenterRef = useRef(0);

  const getTimeFromX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return xToTime(clientX - rect.left, rect.width, viewRangeRef.current);
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    // Wheel handler with trackpad horizontal scroll detection
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pivot = getTimeFromX(e.clientX);

      // Horizontal scroll (trackpad two-finger swipe) → pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 1) {
        const range = viewRangeRef.current;
        const pxWidth = canvas.getBoundingClientRect().width;
        const timePerPx = (range.end - range.start) / pxWidth;
        callbacksRef.current.onPan(e.deltaX * timePerPx);
        return;
      }

      // Vertical scroll → zoom
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      callbacksRef.current.onWheelZoom(pivot, factor);
    };

    // Double-click → zoom in 2× at point
    const handleDblClick = (e: MouseEvent) => {
      const pivot = getTimeFromX(e.clientX);
      callbacksRef.current.onWheelZoom(pivot, 0.5);
    };

    // Touch: pinch-to-zoom and two-finger pan
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        touchDistRef.current = Math.hypot(dx, dy);
        touchCenterRef.current = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const center = (e.touches[0].clientX + e.touches[1].clientX) / 2;

        // Pinch zoom
        if (touchDistRef.current > 0) {
          const scale = touchDistRef.current / dist;
          const pivot = getTimeFromX(center);
          callbacksRef.current.onWheelZoom(pivot, scale);
        }

        // Two-finger pan
        const range = viewRangeRef.current;
        const pxWidth = canvas.getBoundingClientRect().width;
        const timePerPx = (range.end - range.start) / pxWidth;
        const panDelta = (touchCenterRef.current - center) * timePerPx;
        if (Math.abs(panDelta) > 0) {
          callbacksRef.current.onPan(panDelta);
        }

        touchDistRef.current = dist;
        touchCenterRef.current = center;
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [canvasRef, enabled, getTimeFromX]);
}
