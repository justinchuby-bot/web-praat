import { useState, useMemo, useCallback } from 'react';
import { computeLtas } from '../audio/ltas';
import type { LtasData, LtasSettings } from '../audio/ltas';

export interface LtasPanelProps {
  samples: Float32Array | null;
  sampleRate: number;
}

const DEFAULT_SETTINGS: LtasSettings = {
  fftSize: 4096,
  hopFraction: 0.5,
  maxFrequency: 5000,
};

export function LtasPanel({ samples, sampleRate }: LtasPanelProps) {
  const [settings, setSettings] = useState<LtasSettings>(DEFAULT_SETTINGS);
  const [cursor, setCursor] = useState<{ freq: number; db: number } | null>(null);

  const ltas: LtasData | null = useMemo(() => {
    if (!samples || samples.length === 0) return null;
    return computeLtas(samples, sampleRate, settings);
  }, [samples, sampleRate, settings]);

  const handleMaxFreqChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val > 0) setSettings(s => ({ ...s, maxFrequency: val }));
  }, []);

  const handleFftSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(s => ({ ...s, fftSize: Number(e.target.value) }));
  }, []);

  if (!samples || !ltas) {
    return (
      <section className="panel">
        <h3>LTAS</h3>
        <p className="panel-empty">Load audio to see the Long-Term Average Spectrum.</p>
      </section>
    );
  }

  const { frequencies, values } = ltas;
  const maxDb = Math.max(...Array.from(values));
  const minDb = maxDb - 80;
  const maxFreq = ltas.maxFrequency;

  // Build SVG polyline points
  const points = Array.from(values).map((db, i) => {
    const x = (frequencies[i] / maxFreq) * 100;
    const y = 100 - Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * 100;
    return `${x},${y}`;
  }).join(' ');

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    setCursor({
      freq: xRatio * maxFreq,
      db: maxDb - yRatio * (maxDb - minDb),
    });
  }

  // Statistics
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const peakIdx = values.indexOf(maxDb);
  const peakFreq = frequencies[peakIdx];
  // Slope: linear regression of dB vs frequency
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += frequencies[i];
    sumY += values[i];
    sumXY += frequencies[i] * values[i];
    sumXX += frequencies[i] * frequencies[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  return (
    <section className="panel">
      <h3>LTAS</h3>
      <div className="panel-subtitle">Long-Term Average Spectrum</div>

      {/* Settings */}
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Max freq:
          <input
            type="number"
            value={settings.maxFrequency}
            onChange={handleMaxFreqChange}
            style={{ width: '4rem', marginLeft: '0.25rem' }}
            min={500}
            max={sampleRate / 2}
            step={500}
          />
          Hz
        </label>
        <label>
          FFT:
          <select value={settings.fftSize} onChange={handleFftSizeChange} style={{ marginLeft: '0.25rem' }}>
            <option value={1024}>1024</option>
            <option value={2048}>2048</option>
            <option value={4096}>4096</option>
            <option value={8192}>8192</option>
          </select>
        </label>
      </div>

      {/* Plot */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', fontSize: '0.65rem', opacity: 0.7, padding: '2px 0' }}>
          <span>{Math.round(maxDb)} dB</span>
          <span>{Math.round(minDb)} dB</span>
        </div>
        <svg
          viewBox="0 0 100 100"
          className="spectrum-slice-plot"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '180px', background: 'var(--bg-secondary, #1a1a2e)' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCursor(null)}
        >
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent, #4ecdc4)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
          {/* Cursor crosshair */}
          {cursor && (
            <>
              <line
                x1={(cursor.freq / maxFreq) * 100} y1="0"
                x2={(cursor.freq / maxFreq) * 100} y2="100"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        {/* Frequency axis */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.6 }}>
          <span>0 Hz</span>
          <span>{Math.round(maxFreq / 2)} Hz</span>
          <span>{Math.round(maxFreq)} Hz</span>
        </div>
      </div>

      {/* Cursor readout */}
      {cursor && (
        <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.8 }}>
          {Math.round(cursor.freq)} Hz | {cursor.db.toFixed(1)} dB
        </div>
      )}

      {/* Statistics */}
      <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', lineHeight: 1.6 }}>
        <div><strong>Peak:</strong> {Math.round(peakFreq)} Hz ({maxDb.toFixed(1)} dB)</div>
        <div><strong>Mean:</strong> {mean.toFixed(1)} dB</div>
        <div><strong>Slope:</strong> {(slope * 1000).toFixed(2)} dB/kHz</div>
        <div><strong>Bandwidth:</strong> {Math.round(maxFreq)} Hz ({values.length} bins, Δf = {ltas.frequencyResolution.toFixed(1)} Hz)</div>
      </div>
    </section>
  );
}
