import { describe, expect, it } from 'vitest';
import {
  hzToBark,
  barkToHz,
  hzToErb,
  erbToHz,
  computeCochleagram,
  defaultCochleagramSettings,
} from '../src/audio/cochleagram';
import type { SpectrogramData } from '../src/types';

describe('hzToBark / barkToHz', () => {
  it('converts 1000 Hz to approximately 8.5 Bark', () => {
    const bark = hzToBark(1000);
    expect(bark).toBeCloseTo(8.5, 0);
  });

  it('roundtrips Hz -> Bark -> Hz', () => {
    for (const freq of [100, 500, 1000, 4000, 8000]) {
      const bark = hzToBark(freq);
      const hz = barkToHz(bark);
      expect(hz).toBeCloseTo(freq, 0);
    }
  });

  it('returns 0 Bark at ~50 Hz', () => {
    const bark = hzToBark(50);
    expect(bark).toBeGreaterThan(0);
    expect(bark).toBeLessThan(1);
  });
});

describe('hzToErb / erbToHz', () => {
  it('roundtrips correctly', () => {
    for (const freq of [100, 1000, 5000, 10000]) {
      const erb = hzToErb(freq);
      const hz = erbToHz(erb);
      expect(hz).toBeCloseTo(freq, 0);
    }
  });
});

describe('computeCochleagram', () => {
  function makeSpectrogram(numFrames: number, numBins: number, maxFreq: number): SpectrogramData {
    const magnitudes: Float64Array[] = [];
    for (let f = 0; f < numFrames; f++) {
      const frame = new Float64Array(numBins);
      for (let b = 0; b < numBins; b++) {
        // Simple ascending pattern
        frame[b] = (b + 1) / numBins;
      }
      magnitudes.push(frame);
    }
    return {
      magnitudes,
      timeStep: 0.01,
      freqStep: maxFreq / numBins,
      maxFreq,
      frameTimes: Array.from({ length: numFrames }, (_, i) => i * 0.01),
    };
  }

  it('produces correct number of Bark bins', () => {
    const spec = makeSpectrogram(10, 512, 22050);
    const cochlea = computeCochleagram(spec, defaultCochleagramSettings);
    expect(cochlea.numBarkBins).toBe(64);
    expect(cochlea.magnitudes.length).toBe(10);
    expect(cochlea.magnitudes[0].length).toBe(64);
  });

  it('bin frequencies increase monotonically', () => {
    const spec = makeSpectrogram(5, 256, 16000);
    const cochlea = computeCochleagram(spec);
    for (let i = 1; i < cochlea.binFrequencies.length; i++) {
      expect(cochlea.binFrequencies[i]).toBeGreaterThan(cochlea.binFrequencies[i - 1]);
    }
  });

  it('preserves frame times from spectrogram', () => {
    const spec = makeSpectrogram(8, 128, 8000);
    const cochlea = computeCochleagram(spec);
    expect(cochlea.frameTimes).toEqual(spec.frameTimes);
    expect(cochlea.timeStep).toBe(spec.timeStep);
  });

  it('handles empty spectrogram', () => {
    const spec: SpectrogramData = {
      magnitudes: [],
      timeStep: 0.01,
      freqStep: 10,
      maxFreq: 8000,
      frameTimes: [],
    };
    const cochlea = computeCochleagram(spec);
    expect(cochlea.magnitudes.length).toBe(0);
  });

  it('low bark bins have higher resolution (more FFT bins mapped)', () => {
    // With Bark scale, low-frequency bins span fewer Hz → fewer linear bins
    // High-frequency bins span more Hz → more linear bins
    // This is the key property of cochlear frequency compression
    const spec = makeSpectrogram(1, 1024, 22050);
    const cochlea = computeCochleagram(spec, { numBarkBins: 32, minFreq: 20, maxFreq: 15500 });
    // Higher bins should cover more Hz range
    const lowBinHz = cochlea.binFrequencies[1] - cochlea.binFrequencies[0];
    const highBinHz = cochlea.binFrequencies[31] - cochlea.binFrequencies[30];
    expect(highBinHz).toBeGreaterThan(lowBinHz);
  });

  it('magnitudes are non-negative', () => {
    const spec = makeSpectrogram(5, 256, 16000);
    const cochlea = computeCochleagram(spec);
    for (const frame of cochlea.magnitudes) {
      for (let i = 0; i < frame.length; i++) {
        expect(frame[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
