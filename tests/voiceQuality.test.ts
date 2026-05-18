import { describe, expect, it } from 'vitest';
import { computeVoiceQuality } from '../src/audio/voiceQuality';

function pulseTrain(sampleRate: number, periods: number[], amplitudes?: number[]): Float32Array {
  const totalSamples = periods.reduce((sum, period) => sum + period, 0) + sampleRate * 0.05;
  const samples = new Float32Array(totalSamples);
  let cursor = Math.floor(sampleRate * 0.01);
  periods.forEach((period, index) => {
    const amplitude = amplitudes?.[index] ?? 1;
    if (cursor < samples.length) {
      samples[cursor] = amplitude;
      if (cursor + 1 < samples.length) samples[cursor + 1] = amplitude * 0.4;
    }
    cursor += period;
  });
  return samples;
}

describe('voice quality metrics', () => {
  it('reports near-zero jitter on a regular pulse train', () => {
    const sampleRate = 16000;
    const periods = new Array(12).fill(Math.round(sampleRate / 200));
    const metrics = computeVoiceQuality(pulseTrain(sampleRate, periods), sampleRate);
    expect(metrics.pulses.length).toBeGreaterThan(8);
    expect(metrics.jitterLocalPercent).toBeLessThan(0.5);
  });

  it('reports positive jitter when pulse periods vary', () => {
    const sampleRate = 16000;
    const periods = [80, 81, 79, 83, 78, 82, 80, 84, 79, 81];
    const metrics = computeVoiceQuality(pulseTrain(sampleRate, periods), sampleRate);
    expect(metrics.jitterLocalPercent).toBeGreaterThan(0.2);
    expect(metrics.jitterAbsolute).toBeGreaterThan(0);
  });

  it('reports positive shimmer when amplitudes vary', () => {
    const sampleRate = 16000;
    const periods = new Array(10).fill(80);
    const amplitudes = [1, 0.8, 1.1, 0.9, 1.2, 0.85, 1.05, 0.95, 1.1, 0.9];
    const metrics = computeVoiceQuality(pulseTrain(sampleRate, periods, amplitudes), sampleRate);
    expect(metrics.shimmerLocalPercent).toBeGreaterThan(1);
    expect(metrics.shimmerDb).toBeGreaterThan(0);
  });
});
