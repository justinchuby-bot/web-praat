import { describe, it, expect } from 'vitest';
import { computeMfcc } from '../src/audio/mfcc';
import { fftInPlace, ifftInPlace } from '../src/utils/fft';
import { createPraatApi } from '../src/scripting/jsApi';

function makeSine(freq: number, sampleRate: number, duration: number): Float32Array {
  const n = Math.round(sampleRate * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return out;
}

describe('MFCC', () => {
  it('computes correct number of coefficients per frame', () => {
    const samples = makeSine(440, 16000, 0.5);
    const result = computeMfcc(samples, 16000, { numCoeffs: 13 });
    expect(result.numCoeffs).toBe(13);
    expect(result.coefficients.length).toBeGreaterThan(0);
    expect(result.coefficients[0].length).toBe(13);
    expect(result.times.length).toBe(result.coefficients.length);
  });

  it('returns different coefficients for different signals', () => {
    const sine = makeSine(440, 16000, 0.5);
    const noise = new Float32Array(8000);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    const r1 = computeMfcc(sine, 16000);
    const r2 = computeMfcc(noise, 16000);
    // First coefficient (energy) should differ
    expect(r1.coefficients[0][0]).not.toBeCloseTo(r2.coefficients[0][0], 0);
  });
});

describe('IFFT', () => {
  it('round-trips through FFT → IFFT', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin(2 * Math.PI * 3 * i / n);
    const origRe = Float64Array.from(re);

    fftInPlace(re, im);
    ifftInPlace(re, im);

    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(origRe[i], 10);
    }
  });
});

describe('JS API - spectrogram', () => {
  it('returns spectrogram data with frameTimes', () => {
    const samples = makeSine(440, 16000, 0.1);
    const api = createPraatApi({ samples, sampleRate: 16000 }, { logs: [], errors: [] });
    const spec = api.spectrogram();
    expect(spec.magnitudes.length).toBeGreaterThan(0);
    expect(spec.frameTimes.length).toBe(spec.magnitudes.length);
    expect(spec.maxFreq).toBe(8000);
  });
});

describe('JS API - mfcc', () => {
  it('exposes mfcc via api', () => {
    const samples = makeSine(440, 16000, 0.2);
    const api = createPraatApi({ samples, sampleRate: 16000 }, { logs: [], errors: [] });
    const result = api.mfcc();
    expect(result.numCoeffs).toBe(13);
    expect(result.coefficients.length).toBeGreaterThan(0);
  });
});

describe('JS API - fft/ifft', () => {
  it('round-trips signal', () => {
    const samples = makeSine(440, 16000, 0.01);
    const api = createPraatApi({ samples, sampleRate: 16000 }, { logs: [], errors: [] });
    const spectrum = api.fft();
    const reconstructed = api.ifft(spectrum);
    // Should be close to original (zero-padded to power of 2)
    for (let i = 0; i < samples.length; i++) {
      expect(reconstructed[i]).toBeCloseTo(samples[i], 5);
    }
  });
});

describe('JS API - textGrid', () => {
  it('returns null when no textGrid loaded', () => {
    const samples = new Float32Array(100);
    const api = createPraatApi({ samples, sampleRate: 16000 }, { logs: [], errors: [] });
    expect(api.textGrid.data).toBeNull();
    expect(api.textGrid.numTiers).toBe(0);
  });

  it('accesses tiers when textGrid is provided', () => {
    const samples = new Float32Array(100);
    const tg = {
      xmin: 0, xmax: 1,
      tiers: [{
        id: '1', name: 'words', kind: 'interval' as const,
        intervals: [
          { xmin: 0, xmax: 0.5, label: 'hello' },
          { xmin: 0.5, xmax: 1, label: 'world' },
        ]
      }]
    };
    const api = createPraatApi({ samples, sampleRate: 16000, textGrid: tg }, { logs: [], errors: [] });
    expect(api.textGrid.numTiers).toBe(1);
    expect(api.textGrid.getTierByName('words')).toBeTruthy();
    expect(api.textGrid.getLabels('words')).toEqual(['hello', 'world']);
    expect(api.textGrid.getTierByIndex(0)?.name).toBe('words');
  });
});
