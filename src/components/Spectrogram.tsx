import React, { useEffect, useMemo, useRef } from 'react';
import { getColormap } from '../utils/colormap';
import type { AnalysisResult, TimeSelection, ViewRange } from '../types';
import { useZoomPan } from '../hooks/useZoomPan';
import { timeToX, xToTime } from '../utils/view';
import { generateIpaAnnotations } from '../audio/ipaVowels';

interface SpectrogramProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
  viewRange: ViewRange;
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  showIpa: boolean;
  onWheelZoom: (pivotTime: number, zoomFactor: number) => void;
  onPan: (deltaTime: number) => void;
  onZoomSelection: (selection: TimeSelection) => void;
  onSelectionChange: (selection: TimeSelection | null) => void;
  onSpectrumSliceSelect: (time: number) => void;
  onAnalyzeRegion?: () => void;
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
  showIpa,
  onWheelZoom,
  onPan,
  onZoomSelection,
  onSelectionChange,
  onSpectrumSliceSelect,
  onAnalyzeRegion,
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<DragMode>(null);
  const dragStartTimeRef = useRef(0);
  const lastPanTimeRef = useRef(0);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);

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
    const shouldInvert = style.getPropertyValue('--colormap-invert').trim() === '1';
    ctx.fillStyle = style.getPropertyValue('--spectrogram-bg').trim() || '#11111b';
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

    // Determine visible frames
    const visibleFrames: number[] = [];
    for (let i = 0; i < spectrogram.magnitudes.length; i++) {
      const time = spectrogram.frameTimes[i];
      if (time >= viewRange.start && time <= viewRange.end) visibleFrames.push(i);
    }
    if (visibleFrames.length === 0) return;

    // Render to offscreen canvas at native STFT resolution
    const offW = visibleFrames.length;
    const offH = binsToShow;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = offW;
    offCanvas.height = offH;
    const offCtx = offCanvas.getContext('2d')!;
    const imgData = offCtx.createImageData(offW, offH);
    const pixels = imgData.data;

    for (let col = 0; col < visibleFrames.length; col++) {
      const frame = spectrogram.magnitudes[visibleFrames[col]];
      for (let bin = 0; bin < binsToShow; bin++) {
        const value = frame[bin] / globalMax;
        const db = 20 * Math.log10(Math.max(value, 1e-6));
        const normalized = Math.max(
          0,
          Math.min(1, 1 - Math.abs(db) / Math.max(analysis.settings.spectrogram.dynamicRangeDb, 1))
        );
        const mapInput = shouldInvert ? 1 - normalized : normalized;
        const [r, g, b] = colorForValue(mapInput);
        // Flip vertically: bin 0 = lowest freq → bottom row
        const row = offH - 1 - bin;
        const idx = (row * offW + col) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      }
    }
    offCtx.putImageData(imgData, 0, 0);

    // Draw scaled with bilinear interpolation
    const startX = timeToX(spectrogram.frameTimes[visibleFrames[0]], width, viewRange);
    const endX = timeToX(spectrogram.frameTimes[visibleFrames[visibleFrames.length - 1]] + spectrogram.timeStep, width, viewRange);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offCanvas, startX, 0, endX - startX, height);

    // Y-axis frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const freqSteps = [0, 1000, 2000, 3000, 4000, 5000].filter(f => f <= maxDisplayFreq);
    for (const freq of freqSteps) {
      if (freq === 0) continue;
      const y = height - (freq / maxDisplayFreq) * height;
      ctx.fillText(`${freq / 1000}k`, 3, y);
      // Subtle grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (showPitch) {
      ctx.strokeStyle = style.getPropertyValue('--accent').trim() || '#89b4fa';
      ctx.lineWidth = 1.5;
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
      const colors = ['#ff4444', '#44cc44', '#4488ff'];
      analysis.formants.tracked.forEach((track, index) => {
        const color = colors[index] ?? '#ff4444';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillStyle = color;
        // Draw as dots only (Praat style) — no connecting lines
        track.forEach((frequency, frameIndex) => {
          const time = analysis.formants.times[frameIndex];
          if (frequency === null || time < viewRange.start || time > viewRange.end || frequency > maxDisplayFreq) {
            return;
          }
          const x = timeToX(time, width, viewRange);
          const y = height - (frequency / maxDisplayFreq) * height;
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (showIntensity) {
      ctx.strokeStyle = style.getPropertyValue('--intensity-color').trim() || '#a6e3a1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < analysis.intensity.times.length; i++) {
        const time = analysis.intensity.times[i];
        if (time < viewRange.start || time > viewRange.end) continue;
        // Intensity is in dB SPL (absolute). Normalize to visible range.
        // Typical speech: 40-80 dB SPL. Map 30-90 dB to 0-1.
        const normalized = (analysis.intensity.values[i] - 30) / 60;
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
      ctx.fillStyle = style.getPropertyValue('--selection-bg').trim() || 'rgba(137, 180, 250, 0.1)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    // IPA annotations rendered as HTML tier below (not on canvas)

    if (currentTime >= viewRange.start && currentTime <= viewRange.end) {
      const x = timeToX(currentTime, width, viewRange);
      ctx.strokeStyle = style.getPropertyValue('--playhead-color').trim() || '#cdd6f4';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
  }, [analysis, currentTime, selection, showFormants, showIntensity, showIpa, showPitch, viewRange]);

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

  const handleCrosshairMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (crosshairRef.current) {
      crosshairRef.current.style.left = `${x}px`;
      crosshairRef.current.style.top = `${y}px`;
      crosshairRef.current.style.display = 'block';
    }
    if (readoutRef.current && analysis && canvasRect) {
      const maxDisplayFreq = Math.min(analysis.settings.spectrogram.maxViewFrequency, analysis.spectrogram.maxFreq);
      const time = xToTime(x, canvasRect.width, viewRange);
      const canvasY = event.clientY - canvasRect.top;
      const freq = (1 - canvasY / canvasRect.height) * maxDisplayFreq;
      readoutRef.current.textContent = `${time.toFixed(3)}s  ${Math.max(0, Math.round(freq))} Hz`;
      readoutRef.current.style.left = `${x + 8}px`;
      readoutRef.current.style.top = `${y - 18}px`;
      readoutRef.current.style.display = freq >= 0 ? 'block' : 'none';
    }
  };

  const handleCrosshairLeave = () => {
    if (crosshairRef.current) crosshairRef.current.style.display = 'none';
    if (readoutRef.current) readoutRef.current.style.display = 'none';
  };

  // Touch handlers for single-finger selection
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return; // let useZoomPan handle multi-touch
    const rect = canvasRef.current!.getBoundingClientRect();
    const time = xToTime(e.touches[0].clientX - rect.left, rect.width, viewRange);
    dragStartTimeRef.current = time;
    dragModeRef.current = 'select';
    onSelectionChange(null);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1 || dragModeRef.current !== 'select') return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const time = xToTime(e.touches[0].clientX - rect.left, rect.width, viewRange);
    const start = Math.min(dragStartTimeRef.current, time);
    const end = Math.max(dragStartTimeRef.current, time);
    if (end - start > 0.005) {
      onSelectionChange({ start, end });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current === 'select') {
      if (!selection || selection.end - selection.start < 0.005) {
        // Tap → set cursor
        const rect = canvasRef.current!.getBoundingClientRect();
        const touch = e.changedTouches[0];
        const time = xToTime(touch.clientX - rect.left, rect.width, viewRange);
        onSpectrumSliceSelect(time);
      }
    }
    dragModeRef.current = null;
  };

  const ipaAnnotations = useMemo(() => {
    if (!showIpa || !showFormants || !analysis) return [];
    return generateIpaAnnotations(
      analysis.formants.times,
      analysis.formants.tracked[0] ?? [],
      analysis.formants.tracked[1] ?? [],
      analysis.intensity.values,
      { minTimeGap: 0.08, minConfidence: 0.35 }
    );
  }, [showIpa, showFormants, analysis]);

  return (
    <div
      className="spectrogram-container"
      onMouseMove={handleCrosshairMove}
      onMouseLeave={handleCrosshairLeave}
    >
      <canvas
        ref={canvasRef}
        className="spectrogram-canvas"
        aria-label="Spectrogram visualization"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => {
          dragModeRef.current = null;
        }}
      />
      {onAnalyzeRegion && analysis && analysis.spectrogram.magnitudes.length === 0 && (
        <button className="analyze-region-btn" onClick={onAnalyzeRegion}>
          🔍 Analyze This Region
        </button>
      )}
      {ipaAnnotations.length > 0 && (
        <div className="ipa-tier">
          {ipaAnnotations.map((ann, i) => {
            if (ann.time < viewRange.start || ann.time > viewRange.end) return null;
            const pct = (ann.time - viewRange.start) / (viewRange.end - viewRange.start) * 100;
            return (
              <span
                key={i}
                className="ipa-label"
                style={{ left: `${pct}%`, opacity: 0.5 + ann.confidence * 0.5 }}
              >
                {ann.symbol}
              </span>
            );
          })}
        </div>
      )}
      <div ref={crosshairRef} className="spectrogram-crosshair" style={{ display: 'none' }} />
      <div ref={readoutRef} className="spectrogram-readout" style={{ display: 'none' }} />
    </div>
  );
});
