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

  const maxMagnitude = Math.max(...Array.from(slice.fftMagnitudes), 1e-6);
  const points = Array.from(slice.fftMagnitudes).map((magnitude, index) => {
    const x = (index / Math.max(slice.fftMagnitudes.length - 1, 1)) * 100;
    const y = 100 - (magnitude / maxMagnitude) * 100;
    return `${x},${y}`;
  });
  const envelopeMin = Math.min(...Array.from(slice.lpcEnvelope));
  const envelopeMax = Math.max(...Array.from(slice.lpcEnvelope));
  const envelopePoints = Array.from(slice.lpcEnvelope).map((value, index) => {
    const x = (index / Math.max(slice.lpcEnvelope.length - 1, 1)) * 100;
    const y = 100 - ((value - envelopeMin) / Math.max(envelopeMax - envelopeMin, 1e-6)) * 100;
    return `${x},${y}`;
  });

  return (
    <section className="panel">
      <h3>Spectrum Slice</h3>
      <p className="panel-caption">Time {slice.time.toFixed(3)} s</p>
      <svg viewBox="0 0 100 100" className="spectrum-slice-plot" preserveAspectRatio="none">
        <polyline fill="none" stroke="#89b4fa" strokeWidth="1.5" points={points.join(' ')} />
        <polyline fill="none" stroke="#f38ba8" strokeWidth="1.5" points={envelopePoints.join(' ')} />
      </svg>
      <div className="panel-legend">
        <span className="legend-item legend-blue">FFT magnitude</span>
        <span className="legend-item legend-red">LPC envelope</span>
      </div>
    </section>
  );
}
