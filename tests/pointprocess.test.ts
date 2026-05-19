import { describe, it, expect } from 'vitest';
import { computePointProcess } from '../src/audio/pointprocess';

function generateSineWave(freq: number, sampleRate: number, duration: number): Float32Array {
  const n = Math.round(sampleRate * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

describe('computePointProcess', () => {
  it('detects pulses in a periodic signal', () => {
    const freq = 200;
    const sampleRate = 16000;
    const duration = 0.5;
    const samples = generateSineWave(freq, sampleRate, duration);
    const result = computePointProcess(samples, sampleRate);

    expect(result.count).toBeGreaterThan(0);
    expect(result.times.length).toBe(result.count);

    // Pulses should be roughly 1/freq apart
    if (result.times.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < result.times.length; i++) {
        intervals.push(result.times[i] - result.times[i - 1]);
      }
      const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const expectedInterval = 1 / freq;
      // Allow 20% tolerance
      expect(Math.abs(meanInterval - expectedInterval)).toBeLessThan(expectedInterval * 0.2);
    }
  });

  it('returns no pulses for silence', () => {
    const samples = new Float32Array(8000); // all zeros
    const result = computePointProcess(samples, 16000);
    expect(result.count).toBe(0);
  });

  it('returns fewer pulses for noise than a periodic signal', () => {
    const sampleRate = 16000;
    const n = sampleRate; // 1 second
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = Math.random() * 2 - 1;
    const noiseResult = computePointProcess(noise, sampleRate);

    const sine = generateSineWave(150, sampleRate, 1.0);
    const sineResult = computePointProcess(sine, sampleRate);

    // Periodic signal should have more regular pulses
    expect(sineResult.count).toBeGreaterThan(0);
    // Noise might have some spurious detections but should be fewer or zero
    // (with voicing threshold filtering most out)
    expect(noiseResult.count).toBeLessThan(sineResult.count);
  });
});
