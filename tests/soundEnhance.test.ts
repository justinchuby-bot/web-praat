import { describe, it, expect } from 'vitest';
import { reduceNoise, preEmphasis, removeSilence } from '../src/audio/soundEnhance';

describe('Sound Enhance', () => {
  describe('preEmphasis', () => {
    it('applies y[n] = x[n] - α*x[n-1]', () => {
      const input = new Float32Array([1, 2, 3, 4, 5]);
      const result = preEmphasis(input, { alpha: 0.5 });
      expect(result[0]).toBe(1); // first sample unchanged
      expect(result[1]).toBeCloseTo(2 - 0.5 * 1); // 1.5
      expect(result[2]).toBeCloseTo(3 - 0.5 * 2); // 2.0
      expect(result[3]).toBeCloseTo(4 - 0.5 * 3); // 2.5
      expect(result[4]).toBeCloseTo(5 - 0.5 * 4); // 3.0
    });

    it('defaults to alpha=0.97', () => {
      const input = new Float32Array([1, 1, 1]);
      const result = preEmphasis(input);
      expect(result[0]).toBe(1);
      expect(result[1]).toBeCloseTo(1 - 0.97);
      expect(result[2]).toBeCloseTo(1 - 0.97);
    });

    it('with alpha=0 returns original', () => {
      const input = new Float32Array([3, 7, 2, 9]);
      const result = preEmphasis(input, { alpha: 0 });
      for (let i = 0; i < input.length; i++) {
        expect(result[i]).toBe(input[i]);
      }
    });

    it('preserves length', () => {
      const input = new Float32Array(100);
      const result = preEmphasis(input);
      expect(result.length).toBe(100);
    });
  });

  describe('reduceNoise', () => {
    it('reduces noise in signal with noisy preamble', () => {
      const sampleRate = 8000;
      const length = sampleRate * 2; // 2 seconds
      const signal = new Float32Array(length);

      // First 0.5s: noise only
      for (let i = 0; i < sampleRate * 0.5; i++) {
        signal[i] = (Math.random() - 0.5) * 0.1;
      }
      // Rest: sine + same noise
      for (let i = Math.floor(sampleRate * 0.5); i < length; i++) {
        const sine = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
        const noise = (Math.random() - 0.5) * 0.1;
        signal[i] = sine + noise;
      }

      const result = reduceNoise(signal, sampleRate, { frameSize: 256, hopSize: 64 });
      expect(result.length).toBe(signal.length);

      // The signal portion should retain most energy (sine is preserved)
      let signalEnergy = 0;
      let origSignalEnergy = 0;
      const start = Math.floor(sampleRate * 0.6);
      const end = Math.floor(sampleRate * 0.9);
      for (let i = start; i < end; i++) {
        signalEnergy += result[i] * result[i];
        origSignalEnergy += signal[i] * signal[i];
      }
      // Signal should not be completely destroyed
      expect(signalEnergy).toBeGreaterThan(origSignalEnergy * 0.01);
    });

    it('preserves signal length', () => {
      const signal = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) signal[i] = Math.sin(i * 0.1);
      const result = reduceNoise(signal, 8000, { frameSize: 256, hopSize: 64 });
      expect(result.length).toBe(2048);
    });
  });

  describe('removeSilence', () => {
    it('removes silent segments', () => {
      const sampleRate = 8000;
      const frameSize = 1024;
      // Create: 0.5s silence + 0.5s tone + 0.5s silence + 0.5s tone
      const length = sampleRate * 2;
      const signal = new Float32Array(length);

      // Tone at 0.5-1.0s
      for (let i = sampleRate * 0.5; i < sampleRate * 1.0; i++) {
        signal[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      }
      // Tone at 1.5-2.0s
      for (let i = sampleRate * 1.5; i < sampleRate * 2.0; i++) {
        signal[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      }

      const result = removeSilence(signal, sampleRate, {
        threshold: 0.01,
        minSilenceDuration: 0.3,
        frameSize,
      });

      // Result should be shorter (silence removed)
      expect(result.length).toBeLessThan(signal.length);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty for all-silent input', () => {
      const signal = new Float32Array(8000); // all zeros
      const result = removeSilence(signal, 8000, {
        threshold: 0.01,
        minSilenceDuration: 0.1,
        frameSize: 1024,
      });
      expect(result.length).toBe(0);
    });

    it('keeps everything if no silence', () => {
      const sampleRate = 8000;
      const signal = new Float32Array(sampleRate);
      for (let i = 0; i < sampleRate; i++) {
        signal[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      }
      const result = removeSilence(signal, sampleRate, {
        threshold: 0.01,
        minSilenceDuration: 0.1,
        frameSize: 1024,
      });
      // Should keep most/all of the signal
      expect(result.length).toBeGreaterThan(sampleRate * 0.9);
    });
  });
});
