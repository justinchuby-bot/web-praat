import { useRef, useEffect } from 'react';
import { jetColormap } from '../utils/colormap';
import type { AnalysisResult, TimeSelection } from '../types';

interface SpectrogramProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
}

export function Spectrogram({
  analysis,
  selection,
  currentTime,
  showPitch,
  showFormants,
  showIntensity,
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Background
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    const { spectrogram, duration } = analysis;
    const { magnitudes } = spectrogram;
    if (magnitudes.length === 0) return;

    // Find global max for normalization
    let globalMax = 0;
    for (const frame of magnitudes) {
      for (let i = 0; i < frame.length; i++) {
        if (frame[i] > globalMax) globalMax = frame[i];
      }
    }
    if (globalMax === 0) globalMax = 1;

    // Draw spectrogram
    const maxDisplayFreq = 5000; // Show up to 5kHz
    const binsToShow = Math.min(
      magnitudes[0].length,
      Math.ceil(maxDisplayFreq / spectrogram.freqStep)
    );

    const colWidth = width / magnitudes.length;
    const rowHeight = height / binsToShow;

    for (let i = 0; i < magnitudes.length; i++) {
      const x = i * colWidth;
      for (let j = 0; j < binsToShow; j++) {
        const y = height - (j + 1) * rowHeight;
        // Log scale for better visibility
        const val = magnitudes[i][j] / globalMax;
        const logVal = Math.max(0, 1 + Math.log10(Math.max(val, 1e-4)) / 4);
        const [r, g, b] = jetColormap(logVal);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, colWidth + 1, rowHeight + 1);
      }
    }

    // Pitch overlay (blue line)
    if (showPitch && analysis.pitch) {
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      const { times, frequencies } = analysis.pitch;
      for (let i = 0; i < times.length; i++) {
        const f = frequencies[i];
        if (f === null) {
          started = false;
          continue;
        }
        const x = (times[i] / duration) * width;
        const y = height - (f / maxDisplayFreq) * height;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Formant overlay (red dots)
    if (showFormants && analysis.formants) {
      const { times, f1, f2, f3 } = analysis.formants;
      ctx.fillStyle = '#f38ba8';
      for (let i = 0; i < times.length; i++) {
        const x = (times[i] / duration) * width;
        const drawDot = (freq: number | null) => {
          if (freq === null || freq > maxDisplayFreq) return;
          const y = height - (freq / maxDisplayFreq) * height;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fill();
        };
        drawDot(f1[i]);
        drawDot(f2[i]);
        drawDot(f3[i]);
      }
    }

    // Intensity overlay (green line)
    if (showIntensity && analysis.intensity) {
      const { times, values } = analysis.intensity;
      const minDb = -60;
      const maxDb = 0;
      ctx.strokeStyle = '#a6e3a1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < times.length; i++) {
        const x = (times[i] / duration) * width;
        const norm = Math.max(0, Math.min(1, (values[i] - minDb) / (maxDb - minDb)));
        const y = height - norm * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Selection
    if (selection) {
      const x1 = (selection.start / duration) * width;
      const x2 = (selection.end / duration) * width;
      ctx.fillStyle = 'rgba(137, 180, 250, 0.1)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    // Playback cursor
    if (currentTime > 0) {
      const cx = (currentTime / duration) * width;
      ctx.strokeStyle = '#cdd6f4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }

    // Frequency axis labels
    ctx.fillStyle = '#a6adc8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    for (let freq = 1000; freq <= maxDisplayFreq; freq += 1000) {
      const y = height - (freq / maxDisplayFreq) * height;
      ctx.fillText(`${freq / 1000}k`, width - 4, y + 4);
    }
  }, [analysis, selection, currentTime, showPitch, showFormants, showIntensity]);

  return <canvas ref={canvasRef} className="spectrogram-canvas" />;
}
