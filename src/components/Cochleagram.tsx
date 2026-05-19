import React, { useEffect, useRef } from 'react';
import { getColormap } from '../utils/colormap';
import { computeCochleagram, defaultCochleagramSettings } from '../audio/cochleagram';
import type { AnalysisResult, ViewRange } from '../types';
import { timeToX } from '../utils/view';

interface CochleagramProps {
  analysis: AnalysisResult | null;
  viewRange: ViewRange;
}

export const Cochleagram = React.memo(function Cochleagram({
  analysis,
  viewRange,
}: CochleagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const cochleagram = computeCochleagram(spectrogram, defaultCochleagramSettings);
    const { magnitudes, numBarkBins, frameTimes, timeStep } = cochleagram;

    // Find global max for normalization
    let globalMax = 1e-6;
    for (const frame of magnitudes) {
      for (let i = 0; i < frame.length; i++) {
        if (frame[i] > globalMax) globalMax = frame[i];
      }
    }

    const colorForValue = getColormap(analysis.settings.spectrogram.colormap);
    const rowHeight = height / numBarkBins;
    const dynamicRange = analysis.settings.spectrogram.dynamicRangeDb;

    for (let frameIndex = 0; frameIndex < magnitudes.length; frameIndex++) {
      const time = frameTimes[frameIndex];
      if (time < viewRange.start || time > viewRange.end) continue;
      const x = timeToX(time, width, viewRange);
      const nextTime = time + timeStep;
      const nextX = timeToX(nextTime, width, viewRange);
      const colWidth = Math.max(1, nextX - x);

      for (let bin = 0; bin < numBarkBins; bin++) {
        const value = magnitudes[frameIndex][bin] / globalMax;
        const db = 20 * Math.log10(Math.max(value, 1e-6));
        const normalized = Math.max(
          0,
          Math.min(1, 1 - Math.abs(db) / Math.max(dynamicRange, 1))
        );
        const [r, g, b] = colorForValue(normalized);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const y = height - (bin + 1) * rowHeight;
        ctx.fillRect(x, y, colWidth + 1, rowHeight + 1);
      }
    }

    // Draw Bark scale labels on the left
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px monospace';
    const labelCount = 6;
    for (let i = 0; i <= labelCount; i++) {
      const binIndex = Math.round((i / labelCount) * (numBarkBins - 1));
      const freq = cochleagram.binFrequencies[binIndex];
      const y = height - (binIndex + 0.5) * rowHeight;
      const label = freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)}`;
      ctx.fillText(label, 4, y + 3);
    }
  }, [analysis, viewRange]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
});
