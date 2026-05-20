import type { AnalysisResult } from '../types';
import type { TextGrid } from '../types';

export interface IntervalStats {
  tier: string;
  label: string;
  start: number;
  end: number;
  duration: number;
  pitchMean: number | null;
  pitchStdev: number | null;
  f1Mean: number | null;
  f2Mean: number | null;
  f3Mean: number | null;
  intensityMean: number | null;
}

function meanAndStdev(values: (number | null)[], times: number[], start: number, end: number): { mean: number; stdev: number } | null {
  const filtered: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= start && times[i] <= end && values[i] !== null && values[i]! > 0) {
      filtered.push(values[i]!);
    }
  }
  if (filtered.length === 0) return null;
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const variance = filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length;
  return { mean, stdev: Math.sqrt(variance) };
}

export function computeIntervalStats(analysis: AnalysisResult, textGrid: TextGrid): IntervalStats[] {
  const results: IntervalStats[] = [];

  for (const tier of textGrid.tiers) {
    if (tier.kind !== 'interval') continue;
    for (const interval of tier.intervals) {
      if (!interval.label || interval.label.trim() === '') continue;

      const start = interval.start;
      const end = interval.end;
      const duration = end - start;

      const pitch = meanAndStdev(analysis.pitch.frequencies, analysis.pitch.times, start, end);
      const f1 = meanAndStdev(analysis.formants.f1, analysis.formants.times, start, end);
      const f2 = meanAndStdev(analysis.formants.f2, analysis.formants.times, start, end);
      const f3 = meanAndStdev(analysis.formants.f3, analysis.formants.times, start, end);
      const intensity = meanAndStdev(
        analysis.intensity.values.map(v => v),
        analysis.intensity.times,
        start, end
      );

      results.push({
        tier: tier.name,
        label: interval.label,
        start,
        end,
        duration,
        pitchMean: pitch?.mean ?? null,
        pitchStdev: pitch?.stdev ?? null,
        f1Mean: f1?.mean ?? null,
        f2Mean: f2?.mean ?? null,
        f3Mean: f3?.mean ?? null,
        intensityMean: intensity?.mean ?? null,
      });
    }
  }

  return results;
}

export function intervalStatsToCsv(stats: IntervalStats[]): string {
  const headers = ['tier', 'label', 'start', 'end', 'duration', 'pitch_mean', 'pitch_stdev', 'f1_mean', 'f2_mean', 'f3_mean', 'intensity_mean'];
  const rows = stats.map(s => [
    s.tier,
    `"${s.label.replace(/"/g, '""')}"`,
    s.start.toFixed(4),
    s.end.toFixed(4),
    s.duration.toFixed(4),
    s.pitchMean?.toFixed(1) ?? '',
    s.pitchStdev?.toFixed(1) ?? '',
    s.f1Mean?.toFixed(0) ?? '',
    s.f2Mean?.toFixed(0) ?? '',
    s.f3Mean?.toFixed(0) ?? '',
    s.intensityMean?.toFixed(1) ?? '',
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
