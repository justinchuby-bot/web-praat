import React, { useEffect, useMemo, useRef } from 'react';
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

type DragMode = 'select' | 'pan' | 'zoom' | null;

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    const startIndex = Math.max(0, Math.floor(viewRange.start * analysis.sampleRate));
    const endIndex = Math.min(analysis.waveform.length, Math.ceil(viewRange.end * analysis.sampleRate));
    const visibleSamples = analysis.waveform.subarray(startIndex, endIndex);
    const samplesPerPixel = Math.max(1, Math.ceil(visibleSamples.length / Math.max(width, 1)));

    ctx.strokeStyle = '#89b4fa';
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

    if (selection) {
      const x1 = timeToX(selection.start, width, viewRange);
      const x2 = timeToX(selection.end, width, viewRange);
      ctx.fillStyle = 'rgba(137, 180, 250, 0.15)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    if (currentTime >= viewRange.start && currentTime <= viewRange.end) {
      const x = timeToX(currentTime, width, viewRange);
      ctx.strokeStyle = '#f38ba8';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }

    ctx.strokeStyle = '#45475a';
    ctx.beginPath();
    ctx.moveTo(0, height / 2 + 0.5);
    ctx.lineTo(width, height / 2 + 0.5);
    ctx.stroke();
  }, [analysis, currentTime, selection, viewRange]);

  const getTime = (event: React.MouseEvent<HTMLCanvasElement>): number => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return xToTime(event.clientX - rect.left, rect.width, viewRange);
  };

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
    dragModeRef.current = 'select';
    onSelectionChange(null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis || !dragModeRef.current) return;
    const time = getTime(event);
    if (dragModeRef.current === 'pan') {
      const delta = lastPanTimeRef.current - time;
      lastPanTimeRef.current = time;
      onPan(delta);
      return;
    }
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
