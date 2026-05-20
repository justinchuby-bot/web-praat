import { useEffect, useRef } from 'react';
import { computeMfcc } from '../audio/mfcc';

interface MfccPanelProps {
  samples: Float32Array | null;
  sampleRate: number;
  selection?: { start: number; end: number } | null;
}

export function MfccPanel({ samples, sampleRate, selection }: MfccPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !samples || samples.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    const width = rect.width;
    const height = rect.height;

    // Get target samples
    let targetSamples = samples;
    if (selection && selection.end > selection.start) {
      const s = Math.max(0, Math.floor(selection.start * sampleRate));
      const e = Math.min(samples.length, Math.ceil(selection.end * sampleRate));
      targetSamples = samples.slice(s, e) as Float32Array;
    }

    const mfcc = computeMfcc(targetSamples, sampleRate);
    if (mfcc.coefficients.length === 0) return;

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    const numFrames = mfcc.coefficients.length;
    const numCoeffs = mfcc.numCoeffs;

    // Find min/max for normalization
    let min = Infinity, max = -Infinity;
    for (const frame of mfcc.coefficients) {
      for (let c = 1; c < numCoeffs; c++) { // skip c0 (energy)
        min = Math.min(min, frame[c]);
        max = Math.max(max, frame[c]);
      }
    }
    const range = max - min || 1;

    // Draw heatmap
    const padding = { top: 20, right: 10, bottom: 20, left: 35 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const cellW = plotW / numFrames;
    const cellH = plotH / (numCoeffs - 1);

    for (let f = 0; f < numFrames; f++) {
      for (let c = 1; c < numCoeffs; c++) {
        const val = (mfcc.coefficients[f][c] - min) / range;
        const r = Math.round(val * 255);
        const b = Math.round((1 - val) * 255);
        const g = Math.round(val * 100);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const x = padding.left + f * cellW;
        const y = padding.top + plotH - c * cellH;
        ctx.fillRect(x, y, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let c = 1; c < numCoeffs; c += 2) {
      const y = padding.top + plotH - c * cellH + cellH / 2;
      ctx.fillText(`C${c}`, padding.left - 4, y);
    }

    ctx.textAlign = 'center';
    ctx.fillText('MFCC', padding.left + plotW / 2, 10);
  }, [samples, sampleRate, selection]);

  if (!samples || samples.length === 0) {
    return <div className="empty-panel">Load audio to see MFCC</div>;
  }

  return (
    <div className="mfcc-panel">
      <canvas ref={canvasRef} className="mfcc-canvas" />
    </div>
  );
}
