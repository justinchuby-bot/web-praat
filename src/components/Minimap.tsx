import React, { useCallback, useEffect, useRef } from 'react';
import type { AnalysisResult, TimeSelection, ViewRange } from '../types';

interface MinimapProps {
  analysis: AnalysisResult;
  viewRange: ViewRange;
  selection: TimeSelection | null;
  onViewRangeChange: (start: number, end: number) => void;
}

/**
 * Minimap: shows the full waveform with a draggable viewport rectangle.
 * Click to center view; drag viewport edges to resize; drag body to pan.
 */
export const Minimap = React.memo(function Minimap({
  analysis,
  viewRange,
  selection,
  onViewRangeChange,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'left' | 'right'; startX: number; origStart: number; origEnd: number } | null>(null);

  const duration = analysis.duration;

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    // Background
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    // Draw full waveform
    const waveform = analysis.waveform;
    const samplesPerPixel = Math.max(1, Math.ceil(waveform.length / width));
    ctx.strokeStyle = '#585b70';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(waveform.length, start + samplesPerPixel);
      let min = 1, max = -1;
      for (let i = start; i < end; i++) {
        min = Math.min(min, waveform[i]);
        max = Math.max(max, waveform[i]);
      }
      const yMin = ((1 - max) / 2) * height;
      const yMax = ((1 - min) / 2) * height;
      ctx.moveTo(x + 0.5, yMin);
      ctx.lineTo(x + 0.5, yMax);
    }
    ctx.stroke();

    // Draw selection regions
    if (selection) {
      const sx1 = (selection.start / duration) * width;
      const sx2 = (selection.end / duration) * width;
      ctx.fillStyle = 'rgba(137, 180, 250, 0.2)';
      ctx.fillRect(sx1, 0, sx2 - sx1, height);
    }

    // Draw viewport rectangle
    const vx1 = (viewRange.start / duration) * width;
    const vx2 = (viewRange.end / duration) * width;

    // Dim outside viewport
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, vx1, height);
    ctx.fillRect(vx2, 0, width - vx2, height);

    // Viewport border
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx1, 0.5, vx2 - vx1, height - 1);

    // Edge handles
    ctx.fillStyle = '#89b4fa';
    const handleW = 3;
    ctx.fillRect(vx1 - handleW / 2, 0, handleW, height);
    ctx.fillRect(vx2 - handleW / 2, 0, handleW, height);
  }, [analysis, viewRange, selection, duration]);

  const timeFromX = useCallback((clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * duration;
  }, [duration]);

  const getHitZone = useCallback((clientX: number): 'left' | 'right' | 'move' | 'outside' => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const vx1 = (viewRange.start / duration) * rect.width;
    const vx2 = (viewRange.end / duration) * rect.width;
    const edgeTolerance = 6;
    if (Math.abs(x - vx1) < edgeTolerance) return 'left';
    if (Math.abs(x - vx2) < edgeTolerance) return 'right';
    if (x >= vx1 && x <= vx2) return 'move';
    return 'outside';
  }, [viewRange, duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const zone = getHitZone(e.clientX);
    if (zone === 'outside') {
      // Click outside → center view at that point
      const time = timeFromX(e.clientX);
      const viewDuration = viewRange.end - viewRange.start;
      const newStart = Math.max(0, Math.min(duration - viewDuration, time - viewDuration / 2));
      onViewRangeChange(newStart, newStart + viewDuration);
      // Start dragging to move
      dragRef.current = { mode: 'move', startX: e.clientX, origStart: newStart, origEnd: newStart + viewDuration };
    } else {
      dragRef.current = { mode: zone, startX: e.clientX, origStart: viewRange.start, origEnd: viewRange.end };
    }
    e.preventDefault();

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { mode, startX, origStart, origEnd } = dragRef.current;
      const rect = canvasRef.current!.getBoundingClientRect();
      const deltaTime = ((ev.clientX - startX) / rect.width) * duration;

      if (mode === 'move') {
        const viewDur = origEnd - origStart;
        let newStart = origStart + deltaTime;
        newStart = Math.max(0, Math.min(duration - viewDur, newStart));
        onViewRangeChange(newStart, newStart + viewDur);
      } else if (mode === 'left') {
        const minView = 0.01;
        const newStart = Math.max(0, Math.min(origEnd - minView, origStart + deltaTime));
        onViewRangeChange(newStart, origEnd);
      } else if (mode === 'right') {
        const minView = 0.01;
        const newEnd = Math.min(duration, Math.max(origStart + minView, origEnd + deltaTime));
        onViewRangeChange(origStart, newEnd);
      }
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [getHitZone, timeFromX, viewRange, duration, onViewRangeChange]);

  const handleMouseMoveLocal = useCallback((e: React.MouseEvent) => {
    const zone = getHitZone(e.clientX);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (zone === 'left' || zone === 'right') {
      canvas.style.cursor = 'ew-resize';
    } else if (zone === 'move') {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'pointer';
    }
  }, [getHitZone]);

  return (
    <canvas
      ref={canvasRef}
      className="minimap-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveLocal}
    />
  );
});
