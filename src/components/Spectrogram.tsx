import React, { useEffect, useMemo, useRef } from 'react';
import { getColormap } from '../utils/colormap';
import type { AnalysisResult, TimeSelection, ViewRange } from '../types';
import { useZoomPan } from '../hooks/useZoomPan';
import { timeToX, xToTime } from '../utils/view';

interface SpectrogramProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
  viewRange: ViewRange;
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  onWheelZoom: (pivotTime: number, zoomFactor: number) => void;
  onPan: (deltaTime: number) => void;
  onZoomSelection: (selection: TimeSelection) => void;
  onSelectionChange: (selection: TimeSelection | null) => void;
  onSpectrumSliceSelect: (time: number) => void;
}

type DragMode = 'select' | 'pan' | 'zoom' | null;

export const Spectrogram = React.memo(function Spectrogram({
  analysis,
  selection,
  currentTime,
  viewRange,
  showPitch,
  showFormants,
  showIntensity,
  onWheelZoom,
  onPan,
  onZoomSelection,
  onSelectionChange,
  onSpectrumSliceSelect,
}: SpectrogramProps) {
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

    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    const { spectrogram } = analysis;
    if (spectrogram.magnitudes.length === 0) return;
    const maxDisplayFreq = Math.min(analysis.settings.spectrogram.maxViewFrequency, spectrogram.maxFreq);
    const binsToShow = Math.min(
      spectrogram.magnitudes[0].length,
      Math.ceil(maxDisplayFreq / spectrogram.freqStep)
    );

    const globalMax = spectrogram.magnitudes.reduce((outerMax, frame) => {
      let frameMax = outerMax;
      for (let i = 0; i < frame.length; i++) {
        frameMax = Math.max(frameMax, frame[i]);
      }
      return frameMax;
    }, 1e-6);

    const colorForValue = getColormap(analysis.settings.spectrogram.colormap);
    const rowHeight = height / binsToShow;

    for (let frameIndex = 0; frameIndex < spectrogram.magnitudes.length; frameIndex++) {
      const time = spectrogram.frameTimes[frameIndex];
      if (time < viewRange.start || time > viewRange.end) continue;
      const x = timeToX(time, width, viewRange);
      const nextTime = time + spectrogram.timeStep;
      const nextX = timeToX(nextTime, width, viewRange);
      const colWidth = Math.max(1, nextX - x);

      for (let bin = 0; bin < binsToShow; bin++) {
        const value = spectrogram.magnitudes[frameIndex][bin] / globalMax;
        const db = 20 * Math.log10(Math.max(value, 1e-6));
        const normalized = Math.max(
          0,
          Math.min(1, 1 - Math.abs(db) / Math.max(analysis.settings.spectrogram.dynamicRangeDb, 1))
        );
        const [r, g, b] = colorForValue(normalized);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const y = height - (bin + 1) * rowHeight;
        ctx.fillRect(x, y, colWidth + 1, rowHeight + 1);
      }
    }

    if (showPitch) {
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < analysis.pitch.times.length; i++) {
        const frequency = analysis.pitch.frequencies[i];
        const time = analysis.pitch.times[i];
        if (frequency === null || time < viewRange.start || time > viewRange.end) {
          started = false;
          continue;
        }
        const x = timeToX(time, width, viewRange);
        const y = height - (frequency / maxDisplayFreq) * height;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    if (showFormants) {
      const colors = ['#f38ba8', '#fab387', '#f9e2af'];
      analysis.formants.tracked.forEach((track, index) => {
        const color = colors[index] ?? '#f38ba8';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let started = false;
        const dots: Array<{ x: number; y: number }> = [];
        track.forEach((frequency, frameIndex) => {
          const time = analysis.formants.times[frameIndex];
          if (frequency === null || time < viewRange.start || time > viewRange.end || frequency > maxDisplayFreq) {
            started = false;
            return;
          }
          const x = timeToX(time, width, viewRange);
          const y = height - (frequency / maxDisplayFreq) * height;
          dots.push({ x, y });
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Draw dot markers
        ctx.fillStyle = color;
        const dotRadius = 2.5;
        // Limit dots to avoid over-drawing when zoomed out
        const step = dots.length > 200 ? Math.ceil(dots.length / 200) : 1;
        for (let i = 0; i < dots.length; i += step) {
          ctx.beginPath();
          ctx.arc(dots[i].x, dots[i].y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    if (showIntensity) {
      ctx.strokeStyle = '#a6e3a1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < analysis.intensity.times.length; i++) {
        const time = analysis.intensity.times[i];
        if (time < viewRange.start || time > viewRange.end) continue;
        const normalized = (analysis.intensity.values[i] + 80) / 80;
        const x = timeToX(time, width, viewRange);
        const y = height - Math.max(0, Math.min(1, normalized)) * height;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    if (selection) {
      const x1 = timeToX(selection.start, width, viewRange);
      const x2 = timeToX(selection.end, width, viewRange);
      ctx.fillStyle = 'rgba(137, 180, 250, 0.1)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    if (currentTime >= viewRange.start && currentTime <= viewRange.end) {
      const x = timeToX(currentTime, width, viewRange);
      ctx.strokeStyle = '#cdd6f4';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
  }, [analysis, currentTime, selection, showFormants, showIntensity, showPitch, viewRange]);

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
    if (!dragModeRef.current) return;
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
    const time = getTime(event);
    if (dragModeRef.current === 'zoom' && selection && selection.end > selection.start) {
      onZoomSelection(selection);
    } else if (dragModeRef.current === 'select') {
      onSpectrumSliceSelect(time);
    }
    dragModeRef.current = null;
  };

  const zoomPanCallbacks = useMemo(() => ({ onWheelZoom, onPan }), [onWheelZoom, onPan]);
  useZoomPan(canvasRef, viewRange, zoomPanCallbacks, !!analysis);

  return (
    <canvas
      ref={canvasRef}
      className="spectrogram-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        dragModeRef.current = null;
      }}
    />
  );
});
