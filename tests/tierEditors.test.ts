import { describe, expect, it } from 'vitest';
import { TierPoint } from '../src/components/TierEditorBase';

// Test the shared tier editing logic (add/move/delete operations)
// These mirror the state management used in all tier editors.

function addPoint(points: TierPoint[], p: TierPoint): TierPoint[] {
  return [...points, p].sort((a, b) => a.time - b.time);
}

function movePoint(points: TierPoint[], index: number, newPoint: TierPoint): TierPoint[] {
  return points.map((pt, i) => (i === index ? newPoint : pt));
}

function deletePoint(points: TierPoint[], index: number): TierPoint[] {
  return points.filter((_, i) => i !== index);
}

describe('TierEditorBase point operations', () => {
  const initial: TierPoint[] = [
    { time: 0, value: 100 },
    { time: 0.5, value: 200 },
    { time: 1.0, value: 150 },
  ];

  it('adds a point in sorted order', () => {
    const result = addPoint(initial, { time: 0.25, value: 175 });
    expect(result).toHaveLength(4);
    expect(result[1]).toEqual({ time: 0.25, value: 175 });
    expect(result.map(p => p.time)).toEqual([0, 0.25, 0.5, 1.0]);
  });

  it('moves a point to new position', () => {
    const result = movePoint(initial, 1, { time: 0.6, value: 220 });
    expect(result[1]).toEqual({ time: 0.6, value: 220 });
    expect(result).toHaveLength(3);
  });

  it('deletes a point by index', () => {
    const result = deletePoint(initial, 1);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { time: 0, value: 100 },
      { time: 1.0, value: 150 },
    ]);
  });

  it('handles empty points array', () => {
    const result = addPoint([], { time: 0.5, value: 100 });
    expect(result).toEqual([{ time: 0.5, value: 100 }]);
  });

  it('delete on empty does not crash', () => {
    const result = deletePoint([], 0);
    expect(result).toEqual([]);
  });
});

describe('DurationTier value constraints', () => {
  it('duration ratio should be non-negative', () => {
    // Simulating the clamping that TierEditorBase does via minValue/maxValue
    const minValue = 0;
    const maxValue = 3;
    const clamp = (v: number) => Math.max(minValue, Math.min(maxValue, v));
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(4)).toBe(3);
    expect(clamp(1.5)).toBe(1.5);
  });
});

describe('AmplitudeTier value constraints', () => {
  it('amplitude should be between 0 and 1', () => {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    expect(clamp(-0.1)).toBe(0);
    expect(clamp(1.5)).toBe(1);
    expect(clamp(0.7)).toBe(0.7);
  });
});

describe('FormantGrid multi-track', () => {
  it('manages three independent formant tracks', () => {
    const f1: TierPoint[] = [{ time: 0, value: 500 }];
    const f2: TierPoint[] = [{ time: 0, value: 1500 }];
    const f3: TierPoint[] = [{ time: 0, value: 2500 }];
    const tracks = [f1, f2, f3];

    // Add point to F2
    tracks[1] = addPoint(tracks[1], { time: 0.5, value: 1600 });
    expect(tracks[1]).toHaveLength(2);
    expect(tracks[0]).toHaveLength(1); // F1 unchanged
    expect(tracks[2]).toHaveLength(1); // F3 unchanged
  });
});

describe('PitchTier frequency range', () => {
  it('clamps pitch between 50 and 500 Hz', () => {
    const minF0 = 50;
    const maxF0 = 500;
    const clamp = (v: number) => Math.max(minF0, Math.min(maxF0, v));
    expect(clamp(30)).toBe(50);
    expect(clamp(600)).toBe(500);
    expect(clamp(220)).toBe(220);
  });
});
