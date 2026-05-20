import { describe, it, expect } from 'vitest';
import { computeLtas } from '../src/audio/ltas';

describe('LTAS panel computation', () => {
  function makeSine(freq: number, sampleRate: number, duration: number): Float32Array {
    const n = Math.round(sampleRate * duration);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return out;
  }

  it('computes LTAS for a sine wave with peak near the frequency', () => {
    const sr = 16000;
    const samples = makeSine(1000, sr, 1.0);
    const ltas = computeLtas(samples, sr, { fftSize: 4096, hopFraction: 0.5, maxFrequency: 5000 });

    expect(ltas.frequencies.length).toBeGreaterThan(0);
    expect(ltas.values.length).toBe(ltas.frequencies.length);
    expect(ltas.maxFrequency).toBe(5000);

    // Peak should be near 1000 Hz
    let peakIdx = 0;
    for (let i = 1; i < ltas.values.length; i++) {
      if (ltas.values[i] > ltas.values[peakIdx]) peakIdx = i;
    }
    const peakFreq = ltas.frequencies[peakIdx];
    expect(peakFreq).toBeGreaterThan(900);
    expect(peakFreq).toBeLessThan(1100);
  });

  it('respects maxFrequency setting', () => {
    const sr = 44100;
    const samples = makeSine(440, sr, 0.5);
    const ltas = computeLtas(samples, sr, { fftSize: 2048, hopFraction: 0.5, maxFrequency: 3000 });
    const lastFreq = ltas.frequencies[ltas.frequencies.length - 1];
    expect(lastFreq).toBeLessThanOrEqual(3000);
  });

  it('handles very short signals', () => {
    const sr = 16000;
    const samples = new Float32Array(100); // very short
    samples[0] = 1;
    const ltas = computeLtas(samples, sr, { fftSize: 4096, hopFraction: 0.5, maxFrequency: 8000 });
    expect(ltas.values.length).toBeGreaterThan(0);
  });

  it('returns correct frequency resolution', () => {
    const sr = 16000;
    const samples = makeSine(500, sr, 1.0);
    const ltas = computeLtas(samples, sr, { fftSize: 4096, hopFraction: 0.5, maxFrequency: 8000 });
    expect(ltas.frequencyResolution).toBeCloseTo(sr / 4096, 2);
  });
});
