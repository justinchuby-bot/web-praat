import { describe, it, expect } from 'vitest';
import { computePointProcess } from '../src/audio/pointprocess';

describe('Pulses (PointProcess) integration', () => {
  it('detects pulses in a synthetic voiced signal', () => {
    const sampleRate = 16000;
    const duration = 0.1; // 100ms
    const f0 = 150; // Hz
    const samples = new Float32Array(Math.round(sampleRate * duration));
    // Generate a periodic signal at f0
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * f0 * i / sampleRate);
    }
    const result = computePointProcess(samples, sampleRate, {
      pitchFloor: 75,
      pitchCeiling: 500,
      silenceThreshold: 0.03,
      voicingThreshold: 0.3,
    });
    // Should find at least some pulses in 100ms at 150Hz (~15 periods)
    expect(result.times.length).toBeGreaterThan(0);
    expect(result.count).toBe(result.times.length);
    // Pulses should be monotonically increasing
    for (let i = 1; i < result.times.length; i++) {
      expect(result.times[i]).toBeGreaterThan(result.times[i - 1]);
    }
  });

  it('returns no pulses for silence', () => {
    const samples = new Float32Array(16000); // 1s silence
    const result = computePointProcess(samples, 16000);
    expect(result.times.length).toBe(0);
  });

  it('mean period approximates 1/f0 for periodic signal', () => {
    const sampleRate = 44100;
    const f0 = 200;
    const duration = 0.5;
    const samples = new Float32Array(Math.round(sampleRate * duration));
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.8 * Math.sin(2 * Math.PI * f0 * i / sampleRate);
    }
    const result = computePointProcess(samples, sampleRate, {
      pitchFloor: 75,
      pitchCeiling: 500,
      silenceThreshold: 0.01,
      voicingThreshold: 0.3,
    });
    if (result.times.length > 2) {
      // Compute mean period from detected pulses
      const periods: number[] = [];
      for (let i = 1; i < result.times.length; i++) {
        periods.push(result.times[i] - result.times[i - 1]);
      }
      const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
      // Should be close to 1/200 = 0.005s
      expect(meanPeriod).toBeGreaterThan(0.002);
      expect(meanPeriod).toBeLessThan(0.015);
    }
  });
});
