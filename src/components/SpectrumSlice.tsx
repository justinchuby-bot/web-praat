import { useState } from 'react';
import type { SpectrumSliceData } from '../types';

interface SpectrumSliceProps {
  slice: SpectrumSliceData | null;
}

export function SpectrumSlice({ slice }: SpectrumSliceProps) {
  if (!slice) {
    return (
      <section className="panel">
        <h3>Spectrum Slice</h3>
        <p className="panel-empty">Click the spectrogram to see the frequency spectrum at one point in time.</p>
      </section>
    );
  }

  // Convert FFT to dB scale; LPC envelope is already in dB from evaluateLpcEnvelope
  const fftDb = Array.from(slice.fftMagnitudes).map(m => m > 0 ? 20 * Math.log10(m) : -120);
  const envDb = Array.from(slice.lpcEnvelope); // already in dB
  const allDb = [...fftDb, ...envDb];
  const maxDb = Math.max(...allDb);
  const minDb = maxDb - 80; // 80 dB dynamic range

  const points = fftDb.map((db, index) => {
    const x = (index / Math.max(fftDb.length - 1, 1)) * 100;
    const y = 100 - Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * 100;
    return `${x},${y}`;
  });
  const envelopePoints = envDb.map((db, index) => {
    const x = (index / Math.max(envDb.length - 1, 1)) * 100;
    const y = 100 - Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * 100;
    return `${x},${y}`;
  });

  // Frequency range
  const maxFreq = slice.fftFrequencies[slice.fftFrequencies.length - 1] || 0;

  // Find formant peaks (local maxima of LPC envelope)
  const peaks: { index: number; freq: number; db: number; x: number; y: number }[] = [];
  for (let i = 1; i < envDb.length - 1; i++) {
    if (envDb[i] > envDb[i - 1] && envDb[i] > envDb[i + 1]) {
      const freq = (i / Math.max(envDb.length - 1, 1)) * maxFreq;
      const x = (i / Math.max(envDb.length - 1, 1)) * 100;
      const y = 100 - Math.max(0, Math.min(1, (envDb[i] - minDb) / (maxDb - minDb))) * 100;
      peaks.push({ index: i, freq, db: envDb[i], x, y });
    }
  }
  const formants = peaks.slice(0, 3); // F1, F2, F3

  // Hover state
  const [cursor, setCursor] = useState<{ freq: number; db: number } | null>(null);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    const freq = xRatio * maxFreq;
    const db = maxDb - yRatio * (maxDb - minDb);
    setCursor({ freq, db });
  }

  function handleMouseLeave() {
    setCursor(null);
  }

  return (
    <section className="panel">
      <h3>Spectrum Slice</h3>
      <div className="panel-subtitle">t = {slice.time.toFixed(3)} s</div>
      <div style={{ position: 'relative' }}>
        <div className="panel-axis-labels" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', fontSize: '0.65rem', opacity: 0.7, padding: '2px 0' }}>
          <span>{Math.round(maxDb)} dB</span>
          <span>{Math.round(minDb)} dB</span>
        </div>
        <svg
          viewBox="0 0 100 100"
          className="spectrum-slice-plot"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <polyline fill="none" stroke="var(--accent)" strokeWidth="0.4" points={points.join(' ')} />
          <polyline fill="none" stroke="var(--red)" strokeWidth="0.6" points={envelopePoints.join(' ')} />
          {formants.map((f, i) => (
            <g key={i}>
              <circle cx={f.x} cy={f.y} r="1.2" fill="var(--red)" />
              <text x={f.x} y={f.y - 2.5} textAnchor="middle" fontSize="3.5" fill="var(--red)">F{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="panel-axis-labels">
        <span>0 Hz</span>
        <span>{maxFreq > 1000 ? `${(maxFreq / 1000).toFixed(1)} kHz` : `${Math.round(maxFreq)} Hz`}</span>
      </div>
      {cursor && (
        <div className="panel-axis-labels" style={{ fontSize: '0.7rem', opacity: 0.85 }}>
          <span>{cursor.freq > 1000 ? `${(cursor.freq / 1000).toFixed(2)} kHz` : `${Math.round(cursor.freq)} Hz`}</span>
          <span>{cursor.db.toFixed(1)} dB</span>
        </div>
      )}
      <div className="panel-legend">
        <span className="legend-item legend-blue">FFT</span>
        <span className="legend-item legend-red">LPC envelope</span>
      </div>
    </section>
  );
}
