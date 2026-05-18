import type { RhythmMetrics } from '../types';

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

export function computeRhythmMetrics(durations: number[]): RhythmMetrics {
  if (durations.length === 0) {
    return {
      count: 0,
      mean: 0,
      stdev: 0,
      min: 0,
      max: 0,
      nPVI: 0,
      rPVI: 0,
    };
  }

  const avg = mean(durations);
  const variance = mean(durations.map((duration) => (duration - avg) ** 2));
  let nPviSum = 0;
  let rPviSum = 0;
  for (let i = 0; i < durations.length - 1; i++) {
    const a = durations[i];
    const b = durations[i + 1];
    rPviSum += Math.abs(a - b);
    const denom = (a + b) / 2;
    if (denom > 0) {
      nPviSum += Math.abs(a - b) / denom;
    }
  }

  const pairCount = Math.max(durations.length - 1, 1);
  return {
    count: durations.length,
    mean: avg,
    stdev: Math.sqrt(variance),
    min: Math.min(...durations),
    max: Math.max(...durations),
    nPVI: (100 * nPviSum) / pairCount,
    rPVI: rPviSum / pairCount,
  };
}
