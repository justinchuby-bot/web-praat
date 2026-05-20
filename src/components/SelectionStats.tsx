import type { AnalysisResult, TimeSelection } from '../types';

interface SelectionStatsProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
}

function computeStats(values: (number | null)[], times: number[], start: number, end: number) {
  const filtered: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= start && times[i] <= end && values[i] !== null && values[i]! > 0) {
      filtered.push(values[i]!);
    }
  }
  if (filtered.length === 0) return null;
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const variance = filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length;
  const stdev = Math.sqrt(variance);
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  return { mean, stdev, min, max, n: filtered.length };
}

export function SelectionStats({ analysis, selection }: SelectionStatsProps) {
  if (!analysis || !selection || selection.end - selection.start < 0.001) return null;

  const { start, end } = selection;
  const duration = end - start;

  const pitchStats = computeStats(
    analysis.pitch.frequencies,
    analysis.pitch.times,
    start, end
  );

  const f1Stats = computeStats(analysis.formants.f1, analysis.formants.times, start, end);
  const f2Stats = computeStats(analysis.formants.f2, analysis.formants.times, start, end);
  const f3Stats = computeStats(analysis.formants.f3, analysis.formants.times, start, end);

  return (
    <div className="selection-stats">
      <span className="selection-stats-duration">{(duration * 1000).toFixed(0)} ms</span>
      {pitchStats && (
        <span className="selection-stats-item" title={`Pitch: ${pitchStats.min.toFixed(0)}–${pitchStats.max.toFixed(0)} Hz, σ=${pitchStats.stdev.toFixed(1)}`}>
          F0: {pitchStats.mean.toFixed(0)} Hz
        </span>
      )}
      {f1Stats && (
        <span className="selection-stats-item" title={`F1: ${f1Stats.min.toFixed(0)}–${f1Stats.max.toFixed(0)} Hz`}>
          F1: {f1Stats.mean.toFixed(0)}
        </span>
      )}
      {f2Stats && (
        <span className="selection-stats-item" title={`F2: ${f2Stats.min.toFixed(0)}–${f2Stats.max.toFixed(0)} Hz`}>
          F2: {f2Stats.mean.toFixed(0)}
        </span>
      )}
      {f3Stats && (
        <span className="selection-stats-item" title={`F3: ${f3Stats.min.toFixed(0)}–${f3Stats.max.toFixed(0)} Hz`}>
          F3: {f3Stats.mean.toFixed(0)}
        </span>
      )}
    </div>
  );
}
