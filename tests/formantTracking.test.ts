import { describe, expect, it } from 'vitest';
import { trackFormants } from '../src/audio/formantTracking';

describe('formant tracking', () => {
  it('follows a stable synthetic vowel trajectory', () => {
    const frames = Array.from({ length: 5 }, (_, index) => ({
      time: index * 0.01,
      candidates: [520 + index * 5, 1480 + index * 5, 2510 + index * 8],
    }));
    const tracked = trackFormants(frames, 3);
    // With smoothing, values converge toward track center — allow ±15 Hz
    expect(Math.abs((tracked[0][0] ?? 0) - 520)).toBeLessThan(15);
    expect(Math.abs((tracked[1][4] ?? 0) - 1500)).toBeLessThan(15);
    expect(Math.abs((tracked[2][2] ?? 0) - 2526)).toBeLessThan(15);
  });

  it('prefers continuity over a sudden distractor candidate', () => {
    const frames = [
      { time: 0, candidates: [500, 1400, 2400] },
      { time: 0.01, candidates: [520, 1450, 2450] },
      { time: 0.02, candidates: [530, 2500, 1500] },
    ];
    const tracked = trackFormants(frames, 2);
    // F1 should stay near 500-530 range, not jump to 2500
    expect((tracked[0][2] ?? 0) < 800).toBe(true);
    // F2 should stay near 1400-1500, not jump to 2500
    expect((tracked[1][2] ?? 0) < 2000).toBe(true);
  });

  it('handles empty frames gracefully', () => {
    const tracked = trackFormants([], 3);
    expect(tracked.length).toBe(3);
    tracked.forEach((track) => expect(track.length).toBe(0));
  });

  it('produces smoother output with higher smoothing window', () => {
    // Create a track with one outlier
    const frames = Array.from({ length: 7 }, (_, i) => ({
      time: i * 0.01,
      candidates: [500, 1500, 2500],
    }));
    // Insert outlier at frame 3
    frames[3] = { time: 0.03, candidates: [700, 1500, 2500] };

    const noSmooth = trackFormants(frames, 1, { smoothingWindow: 1, medianFilterSize: 1, transitionCostWeight: 1 });
    const smoothed = trackFormants(frames, 1, { smoothingWindow: 5, medianFilterSize: 3, transitionCostWeight: 1 });

    // Smoothed version should have smaller deviation at outlier frame
    const noSmoothDev = Math.abs((noSmooth[0][3] ?? 500) - 500);
    const smoothedDev = Math.abs((smoothed[0][3] ?? 500) - 500);
    expect(smoothedDev).toBeLessThanOrEqual(noSmoothDev);
  });
});
