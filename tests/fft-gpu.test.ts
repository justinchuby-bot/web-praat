import { describe, it, expect } from 'vitest';
import { fftMagnitudeFallback, isGpuAvailable } from '../src/utils/fft-gpu';
import { fftMagnitude } from '../src/utils/fft';

describe('fft-gpu', () => {
  it('fallback produces same results as CPU fft', () => {
    const sampleRate = 44100;
    const freq = 440;
    const fftSize = 1024;
    const signal = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const cpuResult = fftMagnitude(signal, fftSize);
    const fallbackResult = fftMagnitudeFallback(signal, fftSize);

    expect(fallbackResult.length).toBe(cpuResult.length);
    for (let i = 0; i < cpuResult.length; i++) {
      expect(fallbackResult[i]).toBeCloseTo(cpuResult[i], 10);
    }
  });

  it('reports GPU as unavailable in Node environment', () => {
    // In test (Node), WebGPU is not available
    expect(isGpuAvailable()).toBe(false);
  });

  it('handles zero-length signal gracefully', () => {
    const signal = new Float64Array(0);
    const result = fftMagnitudeFallback(signal, 256);
    expect(result.length).toBe(129); // 256/2 + 1
    // All zeros
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('handles signal shorter than fftSize (zero-pads)', () => {
    const fftSize = 512;
    const signal = new Float64Array(100);
    signal[0] = 1.0; // impulse
    const result = fftMagnitudeFallback(signal, fftSize);
    expect(result.length).toBe(fftSize / 2 + 1);
    // Impulse → flat magnitude spectrum (all bins ≈ 1)
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeCloseTo(1.0, 5);
    }
  });
});
