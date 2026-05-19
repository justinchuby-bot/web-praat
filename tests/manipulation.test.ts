import { describe, it, expect } from 'vitest';
import { extractPulses, synthesizePsola } from '../src/utils/psola';
import type { PitchData, PitchTierPoint, DurationTierPoint } from '../src/types';

function generateSine(freq: number, duration: number, sampleRate: number): Float32Array {
  const length = Math.round(duration * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

function makePitchData(freq: number, duration: number, step: number): PitchData {
  const times: number[] = [];
  const frequencies: (number | null)[] = [];
  for (let t = 0; t < duration; t += step) {
    times.push(t);
    frequencies.push(freq);
  }
  return { times, frequencies };
}

describe('manipulation (TD-PSOLA)', () => {
  const sampleRate = 16000;
  const freq = 200;
  const duration = 0.1;
  const samples = generateSine(freq, duration, sampleRate);
  const pitchData = makePitchData(freq, duration, 0.005);

  it('extractPulses produces reasonable pulse positions for 200Hz sine', () => {
    const pulses = extractPulses(samples, sampleRate, pitchData);
    expect(pulses.length).toBeGreaterThan(5);
    // Pulses should be ~5ms apart for 200Hz
    for (let i = 1; i < Math.min(pulses.length, 10); i++) {
      const gap = pulses[i] - pulses[i - 1];
      expect(gap).toBeGreaterThan(0.002);
      expect(gap).toBeLessThan(0.015);
    }
  });

  it('PSOLA identity produces output similar to input', () => {
    const pulses = extractPulses(samples, sampleRate, pitchData);
    const pitchTier: PitchTierPoint[] = [
      { time: 0, frequency: freq },
      { time: duration, frequency: freq },
    ];
    const durationTier: DurationTierPoint[] = [{ time: 0, factor: 1 }];
    const output = synthesizePsola(samples, sampleRate, pulses, pitchTier, durationTier);

    // Output length should be roughly the same
    expect(Math.abs(output.length - samples.length)).toBeLessThan(sampleRate * 0.02);
    // Output should have energy
    const energy = output.reduce((s, v) => s + v * v, 0) / output.length;
    expect(energy).toBeGreaterThan(0.01);
  });

  it('pitch doubling produces higher frequency output', () => {
    const longerDur = 0.2;
    const longerSamples = generateSine(freq, longerDur, sampleRate);
    const longerPitch = makePitchData(freq, longerDur, 0.005);
    const pulses = extractPulses(longerSamples, sampleRate, longerPitch);
    const pitchTier: PitchTierPoint[] = [
      { time: 0, frequency: freq * 2 },
      { time: longerDur, frequency: freq * 2 },
    ];
    const durationTier: DurationTierPoint[] = [{ time: 0, factor: 1 }];
    const output = synthesizePsola(longerSamples, sampleRate, pulses, pitchTier, durationTier);

    // Count zero crossings to estimate frequency
    let crossings = 0;
    for (let i = 1; i < output.length; i++) {
      if ((output[i] >= 0 && output[i - 1] < 0) || (output[i] < 0 && output[i - 1] >= 0)) {
        crossings++;
      }
    }
    const estimatedFreq = (crossings / 2) / (output.length / sampleRate);
    // Should be roughly double (allow wide tolerance for PSOLA artifacts)
    expect(estimatedFreq).toBeGreaterThan(freq * 1.3);
  });

  it('duration factor=2 produces longer output', () => {
    const pulses = extractPulses(samples, sampleRate, pitchData);
    const pitchTier: PitchTierPoint[] = [
      { time: 0, frequency: freq },
      { time: duration, frequency: freq },
    ];
    const durationTier: DurationTierPoint[] = [{ time: 0, factor: 2 }];
    const output = synthesizePsola(samples, sampleRate, pulses, pitchTier, durationTier);

    // Output should be roughly 2x longer
    expect(output.length).toBeGreaterThan(samples.length * 1.5);
    expect(output.length).toBeLessThan(samples.length * 3);
  });
});
