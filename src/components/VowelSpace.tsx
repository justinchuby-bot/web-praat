import { useMemo } from 'react';
import type { AnalysisResult, TimeSelection } from '../types';

interface VowelSpaceProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
}

interface VowelPoint {
  f1: number;
  f2: number;
  time: number;
}

// Standard IPA vowel reference points (F1, F2 in Hz)
const IPA_VOWELS: { symbol: string; f1: number; f2: number }[] = [
  { symbol: 'i', f1: 270, f2: 2300 },
  { symbol: 'y', f1: 235, f2: 2100 },
  { symbol: 'e', f1: 400, f2: 2000 },
  { symbol: 'ø', f1: 370, f2: 1900 },
  { symbol: 'ɛ', f1: 550, f2: 1800 },
  { symbol: 'a', f1: 730, f2: 1100 },
  { symbol: 'ɑ', f1: 700, f2: 1000 },
  { symbol: 'ɔ', f1: 600, f2: 900 },
  { symbol: 'o', f1: 450, f2: 800 },
  { symbol: 'u', f1: 300, f2: 870 },
  { symbol: 'ʊ', f1: 350, f2: 1000 },
  { symbol: 'ɪ', f1: 400, f2: 2000 },
  { symbol: 'æ', f1: 660, f2: 1700 },
  { symbol: 'ʌ', f1: 600, f2: 1200 },
  { symbol: 'ə', f1: 500, f2: 1500 },
];

export function VowelSpace({ analysis, selection, currentTime }: VowelSpaceProps) {
  const points = useMemo(() => {
    if (!analysis) return [];
    const result: VowelPoint[] = [];
    const f1Track = analysis.formants.tracked[0] ?? [];
    const f2Track = analysis.formants.tracked[1] ?? [];
    const times = analysis.formants.times;

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      // Filter to selection if present
      if (selection && (t < selection.start || t > selection.end)) continue;
      const f1 = f1Track[i];
      const f2 = f2Track[i];
      if (f1 && f2 && f1 > 150 && f1 < 1000 && f2 > 500 && f2 < 3000) {
        result.push({ f1, f2, time: t });
      }
    }
    return result;
  }, [analysis, selection]);

  // Find current point (nearest to cursor)
  const currentPoint = useMemo(() => {
    if (!analysis || points.length === 0) return null;
    let nearest: VowelPoint | null = null;
    let minDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.time - currentTime);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest;
  }, [analysis, points, currentTime]);

  // Plot dimensions
  const width = 280;
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Axes: F2 (x, reversed: high left) and F1 (y, reversed: high top)
  const f1Min = 150, f1Max = 900;
  const f2Min = 500, f2Max = 2800;

  const toX = (f2: number) => margin.left + (1 - (f2 - f2Min) / (f2Max - f2Min)) * plotW;
  const toY = (f1: number) => margin.top + (1 - (f1 - f1Min) / (f1Max - f1Min)) * plotH;

  return (
    <div className="vowel-space-panel">
      <div className="vowel-space-header">
        Vowel Space {selection ? '(selection)' : '(all)'}
      </div>
      <svg width={width} height={height} className="vowel-space-svg">
        {/* Background */}
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} fill="var(--bg-base)" stroke="var(--border)" />

        {/* Grid lines */}
        {[200, 400, 600, 800].map(f1 => (
          <line key={`f1-${f1}`} x1={margin.left} x2={margin.left + plotW} y1={toY(f1)} y2={toY(f1)} stroke="var(--border)" strokeDasharray="2,2" />
        ))}
        {[1000, 1500, 2000, 2500].map(f2 => (
          <line key={`f2-${f2}`} x1={toX(f2)} x2={toX(f2)} y1={margin.top} y2={margin.top + plotH} stroke="var(--border)" strokeDasharray="2,2" />
        ))}

        {/* IPA reference points */}
        {IPA_VOWELS.map((v) => (
          <g key={v.symbol}>
            <text
              x={toX(v.f2)}
              y={toY(v.f1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-dim)"
              opacity={0.6}
            >
              {v.symbol}
            </text>
          </g>
        ))}

        {/* Trajectory line */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${toX(p.f2)},${toY(p.f1)}`).join(' ')}
            fill="none"
            stroke="var(--accent, #89b4fa)"
            strokeWidth="0.8"
            opacity="0.4"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.f2)}
            cy={toY(p.f1)}
            r="2"
            fill="var(--accent, #89b4fa)"
            opacity="0.6"
          />
        ))}

        {/* Current cursor point */}
        {currentPoint && (
          <circle
            cx={toX(currentPoint.f2)}
            cy={toY(currentPoint.f1)}
            r="5"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
          />
        )}

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--text-dim)">
          ← F2 (Hz) →
        </text>
        <text x={10} y={margin.top + plotH / 2} textAnchor="middle" fontSize="10" fill="var(--text-dim)" transform={`rotate(-90, 10, ${margin.top + plotH / 2})`}>
          ← F1 (Hz) →
        </text>

        {/* F2 tick labels */}
        {[2500, 2000, 1500, 1000].map(f2 => (
          <text key={f2} x={toX(f2)} y={margin.top + plotH + 12} textAnchor="middle" fontSize="9" fill="var(--text-dim)">
            {f2}
          </text>
        ))}

        {/* F1 tick labels */}
        {[200, 400, 600, 800].map(f1 => (
          <text key={f1} x={margin.left - 4} y={toY(f1)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--text-dim)">
            {f1}
          </text>
        ))}
      </svg>

      {/* Stats */}
      {currentPoint && (
        <div className="vowel-space-stats">
          F1: {currentPoint.f1.toFixed(0)} Hz | F2: {currentPoint.f2.toFixed(0)} Hz
        </div>
      )}
      {points.length > 0 && (
        <div className="vowel-space-stats">
          {points.length} points
        </div>
      )}
    </div>
  );
}
