import { describe, it, expect } from 'vitest';
import {
  generateSineWave,
  detectPitchMarks,
  interpolatePitch,
  mapDuration,
  psolaResynthesize,
  PitchPoint,
  ManipulationState,
} from '../src/audio/psola';

describe('PSOLA resynthesis', () => {
  const sampleRate = 16000;

  describe('generateSineWave', () => {
    it('generates correct length', () => {
      const wave = generateSineWave(200, 0.5, sampleRate);
      expect(wave.length).toBe(8000);
    });
  });

  describe('detectPitchMarks', () => {
    it('detects marks in a periodic signal', () => {
      const wave = generateSineWave(200, 0.5, sampleRate);
      const marks = detectPitchMarks(wave, sampleRate);
      expect(marks.length).toBeGreaterThan(5);
      // Marks should be roughly one period apart (80 samples at 200Hz/16kHz)
      const periods = [];
      for (let i = 1; i < Math.min(marks.length, 10); i++) {
        periods.push(marks[i] - marks[i - 1]);
      }
      const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
      // Should be close to 80 samples (200 Hz at 16kHz)
      expect(avgPeriod).toBeGreaterThan(60);
      expect(avgPeriod).toBeLessThan(110);
    });
  });

  describe('interpolatePitch', () => {
    it('interpolates between two points', () => {
      const tier: PitchPoint[] = [
        { time: 0, frequency: 100 },
        { time: 1, frequency: 200 },
      ];
      expect(interpolatePitch(tier, 0.5)).toBeCloseTo(150, 0);
    });

    it('clamps at boundaries', () => {
      const tier: PitchPoint[] = [
        { time: 0.2, frequency: 100 },
        { time: 0.8, frequency: 200 },
      ];
      expect(interpolatePitch(tier, 0)).toBe(100);
      expect(interpolatePitch(tier, 1)).toBe(200);
    });
  });

  describe('mapDuration', () => {
    it('returns same time with no duration points', () => {
      expect(mapDuration([], 1, 0.5)).toBe(0.5);
    });

    it('stretches time with factor > 1', () => {
      const tier = [{ time: 0, factor: 2 }];
      expect(mapDuration(tier, 1, 0.5)).toBeCloseTo(1.0);
    });

    it('compresses time with factor < 1', () => {
      const tier = [{ time: 0, factor: 0.5 }];
      expect(mapDuration(tier, 1, 1)).toBeCloseTo(0.5);
    });
  });

  describe('psolaResynthesize', () => {
    it('produces output of expected length', () => {
      const wave = generateSineWave(200, 0.5, sampleRate);
      const state: ManipulationState = {
        sampleRate,
        originalSamples: wave,
        pitchTier: [
          { time: 0, frequency: 200 },
          { time: 0.5, frequency: 200 },
        ],
        durationTier: [],
      };
      const output = psolaResynthesize(state);
      // Should be approximately same length (no duration change)
      expect(output.length).toBeGreaterThan(7000);
      expect(output.length).toBeLessThan(9000);
    });

    it('shifts pitch upward - output has higher frequency content', () => {
      const originalFreq = 150;
      const targetFreq = 300;
      const wave = generateSineWave(originalFreq, 0.5, sampleRate);

      const state: ManipulationState = {
        sampleRate,
        originalSamples: wave,
        pitchTier: [
          { time: 0, frequency: targetFreq },
          { time: 0.5, frequency: targetFreq },
        ],
        durationTier: [],
      };
      const output = psolaResynthesize(state);

      // Measure dominant frequency via zero crossings
      const origZC = countZeroCrossings(wave);
      const outZC = countZeroCrossings(output);

      // Output should have roughly 2x zero crossings (pitch doubled)
      const ratio = outZC / origZC;
      expect(ratio).toBeGreaterThan(1.3); // At least clearly higher
    });

    it('duration stretching produces longer output', () => {
      const wave = generateSineWave(200, 0.5, sampleRate);
      const state: ManipulationState = {
        sampleRate,
        originalSamples: wave,
        pitchTier: [
          { time: 0, frequency: 200 },
          { time: 0.5, frequency: 200 },
        ],
        durationTier: [{ time: 0, factor: 2 }],
      };
      const output = psolaResynthesize(state);
      // Should be ~2x longer
      expect(output.length).toBeGreaterThan(wave.length * 1.5);
    });
  });
});

function countZeroCrossings(samples: Float32Array): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      count++;
    }
  }
  return count;
}
