import { describe, it, expect } from 'vitest';
import {
  hammingWindow,
  hanningWindow,
  gaussianWindow,
  bartlettWindow,
  applyWindow,
  preEmphasis,
} from '../src/utils/fft';

describe('Window functions', () => {
  const signal = new Float64Array([1, 1, 1, 1, 1, 1, 1, 1]);

  it('hanning window tapers to zero at edges', () => {
    const result = hanningWindow(signal);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[signal.length - 1]).toBeCloseTo(0, 5);
    expect(result[4]).toBeGreaterThan(0.8);
  });

  it('hamming window does not reach zero', () => {
    const result = hammingWindow(signal);
    expect(result[0]).toBeGreaterThan(0.05);
    expect(result[4]).toBeGreaterThan(0.8);
  });

  it('gaussian window peaks at center', () => {
    const result = gaussianWindow(signal);
    const center = Math.floor(signal.length / 2);
    expect(result[center]).toBeGreaterThan(result[0]);
    expect(result[center]).toBeGreaterThan(result[signal.length - 1]);
  });

  it('bartlett window is triangular', () => {
    const result = bartlettWindow(signal);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[signal.length - 1]).toBeCloseTo(0, 5);
    const center = Math.floor((signal.length - 1) / 2);
    expect(result[center]).toBeGreaterThan(0.8);
  });

  it('applyWindow dispatches correctly', () => {
    const hann = applyWindow(signal, 'hanning');
    const rect = applyWindow(signal, 'rectangular');
    expect(hann[0]).toBeCloseTo(0, 5);
    expect(rect[0]).toBe(1);
  });
});

describe('Pre-emphasis', () => {
  it('applies high-pass filtering', () => {
    const dc = new Float64Array([1, 1, 1, 1, 1, 1, 1, 1]);
    const result = preEmphasis(dc, 6);
    // First sample unchanged
    expect(result[0]).toBe(1);
    // Subsequent samples reduced (DC suppressed)
    expect(Math.abs(result[4])).toBeLessThan(0.6);
  });

  it('no-op when factorDb is 0', () => {
    const signal = new Float64Array([1, 2, 3, 4]);
    const result = preEmphasis(signal, 0);
    expect(result).toBe(signal);
  });
});
