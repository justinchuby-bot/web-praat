import { describe, it, expect } from 'vitest';
import { findNearestZeroCrossing } from '../src/utils/zeroCrossing';

describe('findNearestZeroCrossing', () => {
  it('finds zero crossing at exact boundary', () => {
    // samples: [1, -1] → crossing between index 0 and 1
    const samples = new Float32Array([1, -1]);
    const result = findNearestZeroCrossing(samples, 44100, 0);
    expect(result).toBeCloseTo(0.5 / 44100, 5);
  });

  it('finds nearest crossing when multiple exist', () => {
    // [1, -1, 1, -1] → crossings at 0-1, 1-2, 2-3
    const samples = new Float32Array([1, -1, 1, -1]);
    const sampleRate = 100;
    // time at index 2.5 → nearest crossing is 2-3
    const result = findNearestZeroCrossing(samples, sampleRate, 2.5 / 100);
    expect(result).toBeCloseTo(2.5 / 100, 5);
  });

  it('returns original time when no crossing found', () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const result = findNearestZeroCrossing(samples, 44100, 0.5 / 44100);
    expect(result).toBe(0.5 / 44100);
  });

  it('handles zero sample as crossing', () => {
    const samples = new Float32Array([1, 0, -1]);
    const sampleRate = 100;
    const result = findNearestZeroCrossing(samples, sampleRate, 0);
    // crossing between 0 and 1 (1*0 <= 0)
    expect(result).toBeCloseTo(1 / sampleRate, 5);
  });
});
