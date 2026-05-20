import type { HarmonicityData } from '../audio/harmonicity';

interface HarmonicityPanelProps {
  data: HarmonicityData;
  viewStart: number;
  viewEnd: number;
}

export function HarmonicityPanel({ data, viewStart, viewEnd }: HarmonicityPanelProps) {
  const width = 100; // viewBox units
  const height = 60;

  // Y-axis: -20 to 40 dB (typical range for voice)
  const yMin = -20;
  const yMax = 40;

  const toX = (t: number) => ((t - viewStart) / (viewEnd - viewStart)) * width;
  const toY = (db: number) => (1 - (db - yMin) / (yMax - yMin)) * height;

  // Build path for sounding frames in view
  let pathD = '';
  for (let i = 0; i < data.times.length; i++) {
    const t = data.times[i];
    if (t < viewStart || t > viewEnd) continue;
    if (data.values[i] === -200) continue;
    const x = toX(t);
    const y = toY(Math.max(yMin, Math.min(yMax, data.values[i])));
    pathD += pathD === '' ? `M${x},${y}` : ` L${x},${y}`;
  }

  return (
    <section className="panel">
      <h3>Harmonicity (HNR)</h3>
      <div className="stat-grid">
        <span>Mean HNR</span>
        <strong>{data.meanHnrDb > -200 ? data.meanHnrDb.toFixed(1) : '—'} dB</strong>
        <span>Median HNR</span>
        <strong>{data.medianHnrDb > -200 ? data.medianHnrDb.toFixed(1) : '—'} dB</strong>
      </div>
      <div className="panel-plot-container">
        <div className="panel-y-axis">
          <span>{yMax}</span>
          <span>dB</span>
          <span>{yMin}</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="panel-plot" preserveAspectRatio="none">
          {/* Zero line */}
          <line x1="0" x2={width} y1={toY(0)} y2={toY(0)} stroke="var(--border)" strokeWidth="0.3" strokeDasharray="2 1" />
          {/* HNR contour */}
          {pathD && <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="0.8" />}
        </svg>
      </div>
    </section>
  );
}
