import type { SpectrumSliceData } from '../types';

interface SpectrumSliceProps {
  slice: SpectrumSliceData | null;
}

export function SpectrumSlice({ slice }: SpectrumSliceProps) {
  if (!slice) {
    return (
      <section className="panel">
        <h3>Spectrum Slice</h3>
        <p className="panel-empty">Click the spectrogram to inspect one time slice.</p>
      </section>
    );
  }

  // Convert to dB scale for display (both FFT and LPC on same scale)
  const fftDb = Array.from(slice.fftMagnitudes).map(m => m > 0 ? 20 * Math.log10(m) : -120);
  const envDb = Array.from(slice.lpcEnvelope).map(v => v > 0 ? 20 * Math.log10(v) : -120);
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

  return (
    <section className="panel">
      <h3>Spectrum Slice</h3>
      <p className="panel-caption">Time {slice.time.toFixed(3)} s</p>
      <svg viewBox="0 0 100 100" className="spectrum-slice-plot" preserveAspectRatio="none">
        <polyline fill="none" stroke="#89b4fa" strokeWidth="0.5" points={points.join(' ')} />
        <polyline fill="none" stroke="#f38ba8" strokeWidth="0.5" points={envelopePoints.join(' ')} />
      </svg>
      <div className="panel-legend">
        <span className="legend-item legend-blue">FFT magnitude</span>
        <span className="legend-item legend-red">LPC envelope</span>
      </div>
    </section>
  );
}
