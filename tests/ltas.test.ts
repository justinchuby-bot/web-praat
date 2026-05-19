import { describe, it, expect } from 'vitest';
import { computeLtas } from '../src/audio/ltas';

function generateSineWave(freq: number, sampleRate: number, duration: number): Float32Array {
  const n = Math.round(sampleRate * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

describe('computeLtas', () => {
  it('returns frequency and value arrays of equal length', () => {
    const samples = generateSineWave(440, 16000, 1.0);
    const result = computeLtas(samples, 16000);
    expect(result.frequencies.length).toBe(result.values.length);
    expect(result.frequencies.length).toBeGreaterThan(0);
  });

  it('shows a peak near the sine frequency', () => {
    const freq = 440;
    const sampleRate = 16000;
    const samples = generateSineWave(freq, sampleRate, 1.0);
    const result = computeLtas(samples, sampleRate);

    // Find bin with max power
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < result.values.length; i++) {
      if (result.values[i] > maxVal) {
        maxVal = result.values[i];
        maxIdx = i;
      }
    }
    const peakFreq = result.frequencies[maxIdx];
    // Peak should be within 1 bin of 440 Hz
    expect(Math.abs(peakFreq - freq)).toBeLessThan(result.frequencyResolution * 2);
  });

  it('handles very short signals', () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) samples[i] = Math.sin(2 * Math.PI * 200 * i / 8000);
    const result = computeLtas(samples, 8000);
    expect(result.frequencies.length).toBeGreaterThan(0);
  });

  it('respects maxFrequency setting', () => {
    const samples = generateSineWave(200, 16000, 0.5);
    const result = computeLtas(samples, 16000, { maxFrequency: 4000 });
    const lastFreq = result.frequencies[result.frequencies.length - 1];
    expect(lastFreq).toBeLessThanOrEqual(4000);
  });
});
