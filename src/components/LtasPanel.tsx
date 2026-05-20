import { useEffect, useRef } from 'react';
import { computeLtas } from '../audio/ltas';

interface LtasPanelProps {
  samples: Float32Array | null;
  sampleRate: number;
  selection?: { start: number; end: number } | null;
}

export function LtasPanel({ samples, sampleRate, selection }: LtasPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !samples || samples.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width * window.devicePixelRatio;
    const h = rect.height * window.devicePixelRatio;
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    const width = rect.width;
    const height = rect.height;

    // Compute LTAS for selection or full audio
    let targetSamples = samples;
    if (selection && selection.end > selection.start) {
      const startIdx = Math.max(0, Math.floor(selection.start * sampleRate));
      const endIdx = Math.min(samples.length, Math.ceil(selection.end * sampleRate));
      targetSamples = samples.slice(startIdx, endIdx) as Float32Array;
    }

    const ltas = computeLtas(targetSamples, sampleRate, { maxFrequency: 8000 });

    // Draw
    const padding = { top: 20, right: 15, bottom: 30, left: 45 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    // Find dB range
    let minDb = Infinity, maxDb = -Infinity;
    for (let i = 1; i < ltas.values.length; i++) {
      if (ltas.values[i] > -90) {
        minDb = Math.min(minDb, ltas.values[i]);
        maxDb = Math.max(maxDb, ltas.values[i]);
      }
    }
    minDb = Math.floor(minDb / 10) * 10;
    maxDb = Math.ceil(maxDb / 10) * 10;
    const dbRange = maxDb - minDb || 1;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let db = minDb; db <= maxDb; db += 10) {
      const y = padding.top + plotH * (1 - (db - minDb) / dbRange);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
      ctx.fillText(`${db}`, padding.left - 5, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let freq = 1000; freq <= ltas.maxFrequency; freq += 1000) {
      const x = padding.left + (freq / ltas.maxFrequency) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.fillText(`${freq / 1000}k`, x, padding.top + plotH + 4);
    }

    // LTAS curve
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#89b4fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 1; i < ltas.values.length; i++) {
      const x = padding.left + (ltas.frequencies[i] / ltas.maxFrequency) * plotW;
      const y = padding.top + plotH * (1 - (ltas.values[i] - minDb) / dbRange);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (Hz)', padding.left + plotW / 2, height - 4);
    ctx.save();
    ctx.translate(12, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Power (dB)', 0, 0);
    ctx.restore();

    // Title
    ctx.textAlign = 'left';
    ctx.fillText(selection ? 'LTAS (selection)' : 'LTAS (full)', padding.left, 12);
  }, [samples, sampleRate, selection]);

  if (!samples || samples.length === 0) {
    return <div className="empty-panel">Load audio to see LTAS</div>;
  }

  return (
    <div className="ltas-panel">
      <canvas ref={canvasRef} className="ltas-canvas" />
    </div>
  );
}
