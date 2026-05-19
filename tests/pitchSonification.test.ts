import { describe, it, expect } from 'vitest';
import { sonifyPitch } from '../src/audio/pitchSonification';
import type { PitchData } from '../src/types';

describe('pitchSonification', () => {
  const mockPitch: PitchData = {
    times: [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1],
    frequencies: [100, 110, 120, 130, 140, 150, 140, 130, 120, 110, 100],
  };

  it('generates sine wave output', () => {
    const samples = sonifyPitch(mockPitch, { mode: 'sine', sampleRate: 8000 });
    expect(samples.length).toBe(Math.ceil(0.1 * 8000));
    // Should have non-zero samples
    const nonZero = Array.from(samples).filter(s => Math.abs(s) > 0.001).length;
    expect(nonZero).toBeGreaterThan(samples.length * 0.5);
  });

  it('generates pulse train output', () => {
    const samples = sonifyPitch(mockPitch, { mode: 'pulse', sampleRate: 8000 });
    expect(samples.length).toBe(Math.ceil(0.1 * 8000));
    const max = Math.max(...Array.from(samples).map(Math.abs));
    expect(max).toBeGreaterThan(0);
  });

  it('generates hum output', () => {
    const samples = sonifyPitch(mockPitch, { mode: 'hum', sampleRate: 8000 });
    expect(samples.length).toBe(Math.ceil(0.1 * 8000));
    const max = Math.max(...Array.from(samples).map(Math.abs));
    expect(max).toBeGreaterThan(0);
    // Hum is normalized to ~0.7
    expect(max).toBeLessThanOrEqual(0.71);
  });

  it('handles unvoiced frames (null frequencies)', () => {
    const pitchWithGaps: PitchData = {
      times: [0, 0.01, 0.02, 0.03, 0.04],
      frequencies: [100, null, null, null, 100],
    };
    const samples = sonifyPitch(pitchWithGaps, { mode: 'sine', sampleRate: 8000 });
    expect(samples.length).toBe(Math.ceil(0.04 * 8000));
    // Middle portion should be mostly silent
    const midStart = Math.floor(0.01 * 8000);
    const midEnd = Math.floor(0.03 * 8000);
    const midSamples = Array.from(samples.slice(midStart, midEnd));
    const midEnergy = midSamples.reduce((s, v) => s + v * v, 0) / midSamples.length;
    // Very low energy in unvoiced region
    expect(midEnergy).toBeLessThan(0.01);
  });

  it('returns empty array for insufficient data', () => {
    const short: PitchData = { times: [0], frequencies: [100] };
    const samples = sonifyPitch(short, { mode: 'sine' });
    expect(samples.length).toBe(0);
  });

  it('respects gain parameter', () => {
    const loud = sonifyPitch(mockPitch, { mode: 'sine', sampleRate: 8000, gain: 1.0 });
    const quiet = sonifyPitch(mockPitch, { mode: 'sine', sampleRate: 8000, gain: 0.2 });
    const maxLoud = Math.max(...Array.from(loud).map(Math.abs));
    const maxQuiet = Math.max(...Array.from(quiet).map(Math.abs));
    expect(maxLoud).toBeGreaterThan(maxQuiet * 3);
  });

  it('sine frequency matches input pitch', () => {
    // Constant 200Hz pitch for 0.1s at 8000Hz sample rate
    const constPitch: PitchData = {
      times: [0, 0.05, 0.1],
      frequencies: [200, 200, 200],
    };
    const samples = sonifyPitch(constPitch, { mode: 'sine', sampleRate: 8000, gain: 1.0 });
    // Count zero crossings to estimate frequency
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1] * samples[i] < 0) crossings++;
    }
    // ~2 crossings per cycle, 200Hz * 0.1s = 20 cycles = ~40 crossings
    expect(crossings).toBeGreaterThan(35);
    expect(crossings).toBeLessThan(45);
  });
});
