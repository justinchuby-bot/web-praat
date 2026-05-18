import { describe, expect, it } from 'vitest';
import { computeRhythmMetrics } from '../src/audio/rhythm';

describe('rhythm metrics', () => {
  it('computes mean and variability', () => {
    const metrics = computeRhythmMetrics([0.1, 0.2, 0.3]);
    expect(metrics.mean).toBeCloseTo(0.2);
    expect(metrics.stdev).toBeGreaterThan(0);
  });

  it('computes nPVI and rPVI', () => {
    const metrics = computeRhythmMetrics([0.2, 0.1, 0.3]);
    expect(metrics.rPVI).toBeCloseTo((0.1 + 0.2) / 2);
    expect(metrics.nPVI).toBeGreaterThan(0);
  });
});
