import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AnalysisResult, TimeSelection, ViewRange } from '../types';
import { useZoomPan } from '../hooks/useZoomPan';
import { timeToX, xToTime } from '../utils/view';

interface WaveformProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
  viewRange: ViewRange;
  onSelectionChange: (selection: TimeSelection | null) => void;
  onCursorChange: (time: number) => void;
  onWheelZoom: (pivotTime: number, zoomFactor: number) => void;
  onPan: (deltaTime: number) => void;
  onZoomSelection: (selection: TimeSelection) => void;
}

type DragMode = 'select' | 'pan' | 'zoom' | 'move-selection' | 'resize-left' | 'resize-right' | null;

const EDGE_TOLERANCE = 5; // px

export const Waveform = React.memo(function Waveform({
  analysis,
  selection,
  currentTime,
  viewRange,
  onSelectionChange,
  onCursorChange,
  onWheelZoom,
  onPan,
  onZoomSelection,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<DragMode>(null);
  const dragStartTimeRef = useRef(0);
  const lastPanTimeRef = useRef(0);
  const selectionAtDragStartRef = useRef<TimeSelection | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    const style = getComputedStyle(document.documentElement);
    ctx.fillStyle = style.getPropertyValue('--waveform-bg').trim() || '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    const startIndex = Math.max(0, Math.floor(viewRange.start * analysis.sampleRate));
    const endIndex = Math.min(analysis.waveform.length, Math.ceil(viewRange.end * analysis.sampleRate));
    const visibleSamples = analysis.waveform.subarray(startIndex, endIndex);
    const samplesPerPixel = Math.max(1, Math.ceil(visibleSamples.length / Math.max(width, 1)));

    ctx.strokeStyle = style.getPropertyValue('--waveform-line').trim() || '#89b4fa';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const localStart = x * samplesPerPixel;
      const localEnd = Math.min(visibleSamples.length, localStart + samplesPerPixel);
      let min = 1;
      let max = -1;
      for (let i = localStart; i < localEnd; i++) {
        min = Math.min(min, visibleSamples[i]);
        max = Math.max(max, visibleSamples[i]);
      }
      const yMin = ((1 - max) / 2) * height;
      const yMax = ((1 - min) / 2) * height;
      ctx.moveTo(x + 0.5, yMin);
      ctx.lineTo(x + 0.5, yMax);
    }
    ctx.stroke();

    // Selection region
    if (selection) {
      const x1 = timeToX(selection.start, width, viewRange);
      const x2 = timeToX(selection.end, width, viewRange);
      ctx.fillStyle = style.getPropertyValue('--selection-bg').trim() || 'rgba(137, 180, 250, 0.15)';
      ctx.fillRect(x1, 0, x2 - x1, height);

      // Draw edge handles
      ctx.fillStyle = 'rgba(137, 180, 250, 0.7)';
      ctx.fillRect(x1 - 1, 0, 2, height);
      ctx.fillRect(x2 - 1, 0, 2, height);

      // Small triangular grab indicators at edges (top and bottom)
      ctx.fillStyle = '#89b4fa';
      for (const ex of [x1, x2]) {
        ctx.beginPath();
        ctx.moveTo(ex, 0);
        ctx.lineTo(ex - 4, 6);
        ctx.lineTo(ex + 4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ex, height);
        ctx.lineTo(ex - 4, height - 6);
        ctx.lineTo(ex + 4, height - 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Playhead cursor
    if (currentTime >= viewRange.start && currentTime <= viewRange.end) {
      const x = timeToX(currentTime, width, viewRange);
      ctx.strokeStyle = style.getPropertyValue('--cursor-color').trim() || '#f38ba8';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = style.getPropertyValue('--waveform-center').trim() || '#45475a';
    ctx.beginPath();
    ctx.moveTo(0, height / 2 + 0.5);
    ctx.lineTo(width, height / 2 + 0.5);
    ctx.stroke();
  }, [analysis, currentTime, selection, viewRange]);

  const getTime = (event: React.MouseEvent<HTMLCanvasElement>): number => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return xToTime(event.clientX - rect.left, rect.width, viewRange);
  };

  const getHitZone = useCallback((event: React.MouseEvent<HTMLCanvasElement>): 'left-edge' | 'right-edge' | 'inside' | 'outside' => {
    if (!selection || !canvasRef.current) return 'outside';
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const x1 = timeToX(selection.start, rect.width, viewRange);
    const x2 = timeToX(selection.end, rect.width, viewRange);
    if (Math.abs(x - x1) < EDGE_TOLERANCE) return 'left-edge';
    if (Math.abs(x - x2) < EDGE_TOLERANCE) return 'right-edge';
    if (x > x1 + EDGE_TOLERANCE && x < x2 - EDGE_TOLERANCE) return 'inside';
    return 'outside';
  }, [selection, viewRange]);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis) return;
    const time = getTime(event);
    dragStartTimeRef.current = time;
    lastPanTimeRef.current = time;

    if (event.button === 1 || event.shiftKey) {
      dragModeRef.current = 'pan';
      return;
    }
    if (event.ctrlKey) {
      dragModeRef.current = 'zoom';
      onSelectionChange(null);
      return;
    }

    // Check if clicking on selection edges or inside selection
    const zone = getHitZone(event);
    if (zone === 'left-edge') {
      dragModeRef.current = 'resize-left';
      selectionAtDragStartRef.current = selection;
      return;
    }
    if (zone === 'right-edge') {
      dragModeRef.current = 'resize-right';
      selectionAtDragStartRef.current = selection;
      return;
    }
    if (zone === 'inside') {
      dragModeRef.current = 'move-selection';
      selectionAtDragStartRef.current = selection;
      return;
    }

    dragModeRef.current = 'select';
    onSelectionChange(null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis) return;

    // Update cursor style when not dragging
    if (!dragModeRef.current) {
      const zone = getHitZone(event);
      const canvas = canvasRef.current;
      if (canvas) {
        if (zone === 'left-edge' || zone === 'right-edge') {
          canvas.style.cursor = 'ew-resize';
        } else if (zone === 'inside') {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      }
      return;
    }

    const time = getTime(event);

    if (dragModeRef.current === 'pan') {
      const delta = lastPanTimeRef.current - time;
      lastPanTimeRef.current = time;
      onPan(delta);
      return;
    }

    if (dragModeRef.current === 'resize-left') {
      const orig = selectionAtDragStartRef.current!;
      const newStart = Math.max(0, Math.min(time, orig.end - 0.001));
      onSelectionChange({ start: newStart, end: orig.end });
      return;
    }

    if (dragModeRef.current === 'resize-right') {
      const orig = selectionAtDragStartRef.current!;
      const newEnd = Math.min(analysis.duration, Math.max(time, orig.start + 0.001));
      onSelectionChange({ start: orig.start, end: newEnd });
      return;
    }

    if (dragModeRef.current === 'move-selection') {
      const orig = selectionAtDragStartRef.current!;
      const delta = time - dragStartTimeRef.current;
      const dur = orig.end - orig.start;
      let newStart = orig.start + delta;
      // Clamp
      if (newStart < 0) newStart = 0;
      if (newStart + dur > analysis.duration) newStart = analysis.duration - dur;
      onSelectionChange({ start: newStart, end: newStart + dur });
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      return;
    }

    // select or zoom mode
    const start = Math.min(dragStartTimeRef.current, time);
    const end = Math.max(dragStartTimeRef.current, time);
    if (end - start > 0.001) {
      onSelectionChange({ start, end });
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current === 'zoom' && selection && selection.end > selection.start) {
      onZoomSelection(selection);
    } else if (dragModeRef.current === 'select' && !selection) {
      // Click without drag → move cursor
      const time = getTime(event);
      onCursorChange(time);
    }
    dragModeRef.current = null;
    selectionAtDragStartRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
  };

  const zoomPanCallbacks = useMemo(() => ({ onWheelZoom, onPan }), [onWheelZoom, onPan]);
  useZoomPan(canvasRef, viewRange, zoomPanCallbacks, !!analysis);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
});
