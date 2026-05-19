import { useMemo } from 'react';
import { computeExcitationFromSignal, type ExcitationResult } from '../audio/excitation';

interface ExcitationPatternProps {
  /** Audio samples (mono) */
  samples: Float32Array | null;
  /** Sample rate */
  sampleRate: number;
  /** Optional: start/end sample indices for a selection */
  selectionStart?: number;
  selectionEnd?: number;
}

export function ExcitationPattern({ samples, sampleRate, selectionStart, selectionEnd }: ExcitationPatternProps) {
  const result: ExcitationResult | null = useMemo(() => {
    if (!samples || samples.length === 0) return null;
    let seg = samples;
    if (selectionStart !== undefined && selectionEnd !== undefined && selectionEnd > selectionStart) {
      seg = samples.slice(selectionStart, selectionEnd);
    }
    if (seg.length < 64) return null;
    try {
      return computeExcitationFromSignal(seg, sampleRate, 0.1);
    } catch {
      return null;
    }
  }, [samples, sampleRate, selectionStart, selectionEnd]);

  if (!result) {
    return (
      <section className="panel">
        <h3>Excitation Pattern</h3>
        <p className="panel-empty">Load audio to see the excitation pattern.</p>
      </section>
    );
  }

  const { values, numBins, dBark, loudness } = result;

  // Find range for Y axis
  let maxPhon = 0;
  for (let i = 0; i < numBins; i++) {
    if (values[i] > maxPhon) maxPhon = values[i];
  }
  maxPhon = Math.max(maxPhon, 20); // minimum 20 phon range
  const yMax = Math.ceil(maxPhon / 10) * 10;
  const yMin = 0;

  // Bark range
  const xMax = numBins * dBark; // ~25.6 Bark

  // Build SVG polyline
  const points = Array.from(values).map((phon, i) => {
    const x = ((i + 0.5) * dBark / xMax) * 100;
    const y = 100 - ((phon - yMin) / (yMax - yMin)) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Grid lines for Bark axis (every 5 Bark)
  const barkTicks = [0, 5, 10, 15, 20, 25];
  // Phon grid (every 20 phon)
  const phonTicks: number[] = [];
  for (let p = 0; p <= yMax; p += 20) phonTicks.push(p);

  return (
    <section className="panel">
      <h3>Excitation Pattern</h3>
      <p className="panel-caption">
        Loudness: {loudness.toFixed(1)} sones | Range: 0–{xMax.toFixed(1)} Bark
      </p>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2.5/1' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          {/* Grid */}
          {barkTicks.map(b => {
            const x = (b / xMax) * 100;
            return <line key={`bx${b}`} x1={x} y1={0} x2={x} y2={100} stroke="#444" strokeWidth="0.2" />;
          })}
          {phonTicks.map(p => {
            const y = 100 - ((p - yMin) / (yMax - yMin)) * 100;
            return <line key={`py${p}`} x1={0} y1={y} x2={100} y2={y} stroke="#444" strokeWidth="0.2" />;
          })}
          {/* Excitation curve */}
          <polyline fill="none" stroke="#a6e3a1" strokeWidth="0.6" points={points} />
        </svg>
        {/* Axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#888', marginTop: 2 }}>
          {barkTicks.map(b => <span key={b}>{b}</span>)}
        </div>
      </div>
      <div className="panel-legend">
        <span style={{ fontSize: '0.7rem', color: '#888' }}>X: Frequency (Bark) | Y: Excitation (phon, 0–{yMax})</span>
      </div>
    </section>
  );
}
