import { describe, it, expect } from 'vitest';
import {
  hertzToBark,
  barkToHertz,
  soundPressureToPhon,
  computeExcitation,
  computeExcitationFromSignal,
} from '../src/audio/excitation';

describe('excitation', () => {
  describe('hertzToBark / barkToHertz', () => {
    it('round-trips within tolerance', () => {
      for (const hz of [100, 500, 1000, 3000, 8000]) {
        const bark = hertzToBark(hz);
        const back = barkToHertz(bark);
        expect(back).toBeCloseTo(hz, 0);
      }
    });

    it('returns NaN for negative input', () => {
      expect(hertzToBark(-1)).toBeNaN();
      expect(barkToHertz(-1)).toBeNaN();
    });

    it('0 Hz = 0 Bark', () => {
      expect(hertzToBark(0)).toBeCloseTo(0, 5);
    });
  });

  describe('soundPressureToPhon', () => {
    it('returns 0 for zero pressure', () => {
      expect(soundPressureToPhon(0, 5)).toBe(0);
    });

    it('returns reasonable phon for 1 Pa at mid bark', () => {
      const phon = soundPressureToPhon(1.0, 10);
      // 1 Pa = 94 dB SPL, should be around 94 phon + corrections
      expect(phon).toBeGreaterThan(80);
      expect(phon).toBeLessThan(110);
    });

    it('higher pressure = higher phon', () => {
      const low = soundPressureToPhon(0.01, 10);
      const high = soundPressureToPhon(1.0, 10);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('computeExcitation', () => {
    it('produces correct number of bins', () => {
      const magnitudes = new Float64Array(512).fill(0.001);
      const result = computeExcitation(magnitudes, 44100, 0.1);
      expect(result.numBins).toBe(256); // 25.6 / 0.1
      expect(result.values.length).toBe(256);
      expect(result.dBark).toBe(0.1);
    });

    it('loudness is non-negative', () => {
      const magnitudes = new Float64Array(512).fill(0.001);
      const result = computeExcitation(magnitudes, 44100, 0.1);
      expect(result.loudness).toBeGreaterThanOrEqual(0);
    });

    it('silent input produces zero or near-zero excitation', () => {
      const magnitudes = new Float64Array(512).fill(0);
      const result = computeExcitation(magnitudes, 44100, 0.1);
      const max = Math.max(...result.values);
      expect(max).toBe(0);
    });
  });

  describe('computeExcitationFromSignal', () => {
    it('works with a sine wave', () => {
      const sr = 16000;
      const duration = 0.1;
      const n = Math.round(sr * duration);
      const samples = new Float32Array(n);
      const freq = 1000;
      for (let i = 0; i < n; i++) {
        samples[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sr);
      }
      const result = computeExcitationFromSignal(samples, sr);
      expect(result.numBins).toBe(256);
      expect(result.loudness).toBeGreaterThan(0);
      // Peak should be near the bark corresponding to 1000 Hz
      const peakBark = hertzToBark(1000);
      const peakBin = Math.round(peakBark / result.dBark);
      // The peak region should have high excitation
      const peakValue = result.values[peakBin];
      expect(peakValue).toBeGreaterThan(0);
    });

    it('returns valid result for short signal', () => {
      const samples = new Float32Array(128);
      for (let i = 0; i < 128; i++) samples[i] = Math.random() * 0.1;
      const result = computeExcitationFromSignal(samples, 8000);
      expect(result.numBins).toBe(256);
    });
  });
});
