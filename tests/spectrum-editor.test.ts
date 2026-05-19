import { describe, it, expect } from 'vitest';
import {
  designBiquad,
  applyBiquadFilter,
  designButterworth,
  applyCascadedFilter,
  applyButterworthFilter,
  applyGainCurveFilter,
  presetToGainCurve,
  biquadFrequencyResponse,
  cascadedFrequencyResponse,
  ifftInPlace,
  fftComplex,
} from '../src/audio/filters';
import { fftInPlace } from '../src/utils/fft';

function generateSine(freq: number, sampleRate: number, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return out;
}

describe('designBiquad', () => {
  it('returns valid coefficients for lowpass', () => {
    const c = designBiquad('lowpass', 44100, 1000);
    expect(c.b0).toBeCloseTo(c.b2, 5);
    expect(c.b1).toBeCloseTo(2 * c.b0, 5);
  });

  it('returns valid coefficients for highpass', () => {
    const c = designBiquad('highpass', 44100, 1000);
    expect(c.b0).toBeCloseTo(c.b2, 5);
    expect(c.b1).toBeCloseTo(-2 * c.b0, 5);
  });

  it('returns valid coefficients for notch', () => {
    const c = designBiquad('notch', 44100, 1000);
    expect(c.b0).toBeCloseTo(1, 0);
  });
});

describe('applyBiquadFilter', () => {
  it('passes through when type is none', () => {
    const input = new Float32Array([1, 2, 3, 4]);
    const result = applyBiquadFilter(input, 44100, { type: 'none', cutoffHz: 1000, q: 1 });
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('lowpass attenuates high frequencies', () => {
    const sr = 8000;
    const low = generateSine(100, sr, 512);
    const high = generateSine(3500, sr, 512);
    const mixed = new Float32Array(512);
    for (let i = 0; i < 512; i++) mixed[i] = low[i] + high[i];

    const filtered = applyBiquadFilter(mixed, sr, { type: 'lowpass', cutoffHz: 500, q: Math.SQRT1_2 });

    // Energy in filtered should be mostly the low freq
    let energy = 0;
    for (let i = 256; i < 512; i++) energy += filtered[i] ** 2;
    let lowEnergy = 0;
    for (let i = 256; i < 512; i++) lowEnergy += low[i] ** 2;
    // Filtered energy should be close to low-only energy
    expect(energy).toBeLessThan(lowEnergy * 1.5);
  });
});

describe('designButterworth', () => {
  it('returns correct number of sections for even order', () => {
    const sections = designButterworth('lowpass', 4, 44100, 1000);
    expect(sections.length).toBe(2);
  });

  it('returns correct number of sections for odd order', () => {
    const sections = designButterworth('lowpass', 5, 44100, 1000);
    expect(sections.length).toBe(3); // 2 biquads + 1 first-order
  });

  it('higher order gives steeper rolloff', () => {
    const sr = 44100;
    const bins = 256;
    const sec2 = designButterworth('lowpass', 2, sr, 1000);
    const sec6 = designButterworth('lowpass', 6, sr, 1000);
    const resp2 = cascadedFrequencyResponse(sec2, bins, sr);
    const resp6 = cascadedFrequencyResponse(sec6, bins, sr);
    // At high frequency, 6th order should be more attenuated
    const highBin = Math.round(bins * 0.8);
    expect(resp6[highBin]).toBeLessThan(resp2[highBin]);
  });
});

describe('applyButterworthFilter', () => {
  it('filters signal without NaN', () => {
    const signal = generateSine(440, 44100, 1024);
    const result = applyButterworthFilter(signal, 44100, 'lowpass', 4, 2000);
    expect(result.length).toBe(1024);
    expect(result.some(v => isNaN(v))).toBe(false);
  });
});

describe('FFT/IFFT roundtrip', () => {
  it('ifft(fft(x)) ≈ x', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin(2 * Math.PI * 3 * i / n);
    const origRe = Float64Array.from(re);

    fftInPlace(re, im);
    ifftInPlace(re, im);

    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(origRe[i], 8);
    }
  });
});

describe('applyGainCurveFilter', () => {
  it('unity gain curve preserves signal', () => {
    const signal = generateSine(440, 44100, 256);
    const bins = 129; // 256/2+1
    const unity = new Float64Array(bins).fill(1);
    const result = applyGainCurveFilter(signal, unity);
    for (let i = 0; i < signal.length; i++) {
      expect(result[i]).toBeCloseTo(signal[i], 3);
    }
  });

  it('zero gain curve silences signal', () => {
    const signal = generateSine(440, 44100, 256);
    const bins = 129;
    const zero = new Float64Array(bins).fill(0);
    const result = applyGainCurveFilter(signal, zero);
    for (let i = 0; i < result.length; i++) {
      expect(Math.abs(result[i])).toBeLessThan(1e-10);
    }
  });
});

describe('presetToGainCurve', () => {
  it('none returns all ones', () => {
    const curve = presetToGainCurve('none', 128, 44100, 1000, 1);
    expect(curve.every(v => v === 1)).toBe(true);
  });

  it('lowpass gain is high at low freq and low at high freq', () => {
    const curve = presetToGainCurve('lowpass', 256, 44100, 1000, Math.SQRT1_2, 4);
    expect(curve[0]).toBeGreaterThan(0.9);
    expect(curve[200]).toBeLessThan(0.1);
  });
});

describe('biquadFrequencyResponse', () => {
  it('has correct shape for lowpass', () => {
    const coeffs = designBiquad('lowpass', 44100, 2000);
    const resp = biquadFrequencyResponse(coeffs, 128, 44100);
    // DC should be ~1
    expect(resp[0]).toBeCloseTo(1, 1);
    // Nyquist should be attenuated
    expect(resp[127]).toBeLessThan(0.5);
  });
});
