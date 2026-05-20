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

  return (
    <section className="panel">
      <h3>Spectrum Slice</h3>
      <div className="panel-subtitle">t = {slice.time.toFixed(3)} s</div>
      <svg viewBox="0 0 100 100" className="spectrum-slice-plot" preserveAspectRatio="none">
        <polyline fill="none" stroke="var(--accent)" strokeWidth="0.4" points={points.join(' ')} />
        <polyline fill="none" stroke="var(--red)" strokeWidth="0.6" points={envelopePoints.join(' ')} />
      </svg>
      <div className="panel-axis-labels">
        <span>0 Hz</span>
        <span>{maxFreq > 1000 ? `${(maxFreq / 1000).toFixed(1)} kHz` : `${Math.round(maxFreq)} Hz`}</span>
      </div>
      <div className="panel-legend">
        <span className="legend-item legend-blue">FFT</span>
        <span className="legend-item legend-red">LPC envelope</span>
      </div>
    </section>
  );
}
