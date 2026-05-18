import type { HarmonicityData } from '../audio/harmonicity';

interface HarmonicityPanelProps {
  data: HarmonicityData;
  viewStart: number;
  viewEnd: number;
}

export function HarmonicityPanel({ data, viewStart, viewEnd }: HarmonicityPanelProps) {
  const width = 800;
  const height = 180;
  const padding = { top: 20, bottom: 30, left: 50, right: 20 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Y-axis: -20 to 40 dB (typical range for voice)
  const yMin = -20;
  const yMax = 40;

  const toX = (t: number) => padding.left + ((t - viewStart) / (viewEnd - viewStart)) * plotWidth;
  const toY = (db: number) => padding.top + (1 - (db - yMin) / (yMax - yMin)) * plotHeight;

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

  // Y-axis ticks
  const ticks = [-20, -10, 0, 10, 20, 30, 40];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#333' }}>
        Harmonicity (HNR) — Mean: {data.meanHnrDb > -200 ? data.meanHnrDb.toFixed(1) : '—'} dB | Median: {data.medianHnrDb > -200 ? data.medianHnrDb.toFixed(1) : '—'} dB
      </div>
      <svg width={width} height={height} style={{ background: '#fafafa', borderRadius: 4, border: '1px solid #ddd' }}>
        {/* Grid lines */}
        {ticks.map(tick => (
          <g key={tick}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={toY(tick)} y2={toY(tick)}
              stroke="#e0e0e0" strokeWidth={tick === 0 ? 1 : 0.5}
            />
            <text x={padding.left - 4} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#666">
              {tick}
            </text>
          </g>
        ))}
        {/* HNR contour */}
        {pathD && <path d={pathD} fill="none" stroke="#2196F3" strokeWidth={1.5} />}
        {/* Axis labels */}
        <text x={padding.left - 35} y={height / 2} textAnchor="middle" fontSize={10} fill="#333" transform={`rotate(-90, ${padding.left - 35}, ${height / 2})`}>
          HNR (dB)
        </text>
      </svg>
    </div>
  );
}
