import { describe, expect, it } from 'vitest';
import { trackFormants } from '../src/audio/formantTracking';

describe('formant tracking', () => {
  it('follows a stable synthetic vowel trajectory', () => {
    const frames = Array.from({ length: 5 }, (_, index) => ({
      time: index * 0.01,
      candidates: [520 + index * 5, 1480 + index * 5, 2510 + index * 8],
    }));
    const tracked = trackFormants(frames, 3);
    expect(tracked[0][0]).toBeCloseTo(520, -1);
    expect(tracked[1][4]).toBeCloseTo(1500, -1);
    expect(tracked[2][2]).toBeCloseTo(2526, 0);
  });

  it('prefers continuity over a sudden distractor candidate', () => {
    const frames = [
      { time: 0, candidates: [500, 1400, 2400] },
      { time: 0.01, candidates: [520, 1450, 2450] },
      { time: 0.02, candidates: [530, 2500, 1500] },
    ];
    const tracked = trackFormants(frames, 2);
    expect((tracked[0][2] ?? 0) < 800).toBe(true);
    expect((tracked[1][2] ?? 0) < 2000).toBe(true);
  });
});
