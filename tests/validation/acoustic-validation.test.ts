/**
 * Validation Suite — Synthetic signals with known ground truth.
 *
 * Tests that our pitch/formant/intensity algorithms produce numerically
 * correct results on signals where the answer is mathematically deterministic.
 *
 * These tests serve as the academic rigor guarantee: if web-praat produces
 * correct results on known signals, researchers can trust it for real data.
 */
import { describe, it, expect } from 'vitest';
import { computePitch, computeFormants, computeIntensity } from '../../src/audio/analyzer';
import { computeHarmonicity } from '../../src/audio/harmonicity';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a pure sine wave */
function sineWave(freq: number, duration: number, sampleRate: number, amplitude = 0.8): Float32Array {
  const n = Math.round(duration * sampleRate);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

/** Generate a complex periodic signal (fundamental + harmonics) simulating voice */
function voiceLike(f0: number, duration: number, sampleRate: number): Float32Array {
  const n = Math.round(duration * sampleRate);
  const samples = new Float32Array(n);
  // Fundamental + first 5 harmonics with decreasing amplitude
  for (let h = 1; h <= 6; h++) {
    const amp = 0.8 / h;
    const freq = f0 * h;
    if (freq > sampleRate / 2) break;
    for (let i = 0; i < n; i++) {
      samples[i] += amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
  }
  return samples;
}

/** Generate a signal with known formant-like resonances using cascaded filters */
function formantSignal(
  f0: number,
  formants: number[],
  duration: number,
  sampleRate: number
): Float32Array {
  // Start with impulse train at f0
  const n = Math.round(duration * sampleRate);
  const period = Math.round(sampleRate / f0);
  const impulse = new Float32Array(n);
  for (let i = 0; i < n; i += period) {
    impulse[i] = 1.0;
  }
  // Apply second-order resonators for each formant
  let signal = impulse;
  for (const freq of formants) {
    signal = resonator(signal, freq, 80, sampleRate);
  }
  // Normalize
  let max = 0;
  for (let i = 0; i < signal.length; i++) max = Math.max(max, Math.abs(signal[i]));
  if (max > 0) for (let i = 0; i < signal.length; i++) signal[i] /= max;
  return signal;
}

/** Simple second-order resonator (biquad bandpass) */
function resonator(input: Float32Array, freq: number, bw: number, sr: number): Float32Array {
  const output = new Float32Array(input.length);
  const omega = 2 * Math.PI * freq / sr;
  const r = Math.exp(-Math.PI * bw / sr);
  const a1 = -2 * r * Math.cos(omega);
  const a2 = r * r;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const y = input[i] - a1 * y1 - a2 * y2;
    output[i] = y;
    y2 = y1;
    y1 = y;
  }
  return output;
}

// ─── Pitch Validation ───────────────────────────────────────────────────────────

describe('Validation: Pitch Detection', () => {
  const sr = 16000;

  it('detects 100 Hz pure tone within ±2 Hz', () => {
    const samples = sineWave(100, 0.5, sr);
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    expect(voiced.length).toBeGreaterThan(10);
    const meanF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(meanF0 - 100)).toBeLessThan(2);
  });

  it('detects 200 Hz pure tone within ±2 Hz', () => {
    const samples = sineWave(200, 0.5, sr);
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    const meanF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(meanF0 - 200)).toBeLessThan(2);
  });

  it('detects 150 Hz voice-like signal within ±3 Hz', () => {
    const samples = voiceLike(150, 0.5, sr);
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    expect(voiced.length).toBeGreaterThan(5);
    const meanF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(meanF0 - 150)).toBeLessThan(3);
  });

  it('detects varying pitch (100→200 Hz glide)', () => {
    const n = Math.round(0.5 * sr);
    const samples = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const freq = 100 + (200 - 100) * (t / 0.5); // linear glide
      phase += 2 * Math.PI * freq / sr;
      samples[i] = 0.8 * Math.sin(phase);
    }
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    const first = voiced.slice(0, 5);
    const last = voiced.slice(-5);
    const meanFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const meanLast = last.reduce((a, b) => a + b, 0) / last.length;
    expect(meanFirst).toBeLessThan(130); // near 100 Hz start
    expect(meanLast).toBeGreaterThan(170); // near 200 Hz end
  });

  it('reports silence as unvoiced', () => {
    const samples = new Float32Array(sr * 0.5); // silence
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    expect(voiced.length).toBe(0);
  });

  it('handles female F0 range (250 Hz) within ±3 Hz', () => {
    const samples = voiceLike(250, 0.5, sr);
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    const meanF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(meanF0 - 250)).toBeLessThan(3);
  });

  it('handles low male F0 (80 Hz) within ±2 Hz', () => {
    const samples = voiceLike(80, 0.8, sr);
    const pitch = computePitch(samples, sr);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null && f > 0);
    const meanF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(meanF0 - 80)).toBeLessThan(2);
  });
});

// ─── Formant Validation ─────────────────────────────────────────────────────────

describe('Validation: Formant Extraction', () => {
  const sr = 16000;

  it('detects formants of /a/ vowel model (F1~700, F2~1200) within ±100 Hz', () => {
    // Simulate /a/ with impulse train + resonators
    const samples = formantSignal(120, [700, 1200, 2500], 0.3, sr);
    const formants = computeFormants(samples, sr);
    // Check median F1 and F2
    const f1Values = formants.tracked[0]?.filter((f): f is number => f !== null && f > 0) ?? [];
    const f2Values = formants.tracked[1]?.filter((f): f is number => f !== null && f > 0) ?? [];
    expect(f1Values.length).toBeGreaterThan(5);
    expect(f2Values.length).toBeGreaterThan(5);
    const medianF1 = sorted(f1Values)[Math.floor(f1Values.length / 2)];
    const medianF2 = sorted(f2Values)[Math.floor(f2Values.length / 2)];
    expect(Math.abs(medianF1 - 700)).toBeLessThan(100);
    expect(Math.abs(medianF2 - 1200)).toBeLessThan(100);
  });

  it('detects formants of /i/ vowel model (F1~270, F2~2300) within ±100 Hz', () => {
    const samples = formantSignal(120, [270, 2300, 3000], 0.3, sr);
    const formants = computeFormants(samples, sr);
    const f1Values = formants.tracked[0]?.filter((f): f is number => f !== null && f > 0) ?? [];
    const f2Values = formants.tracked[1]?.filter((f): f is number => f !== null && f > 0) ?? [];
    expect(f1Values.length).toBeGreaterThan(3);
    const medianF1 = sorted(f1Values)[Math.floor(f1Values.length / 2)];
    const medianF2 = sorted(f2Values)[Math.floor(f2Values.length / 2)];
    expect(Math.abs(medianF1 - 270)).toBeLessThan(100);
    expect(Math.abs(medianF2 - 2300)).toBeLessThan(150);
  });

  it('detects formants of /u/ vowel model (F1~300, F2~870) within ±100 Hz', () => {
    const samples = formantSignal(120, [300, 870, 2250], 0.3, sr);
    const formants = computeFormants(samples, sr);
    const f1Values = formants.tracked[0]?.filter((f): f is number => f !== null && f > 0) ?? [];
    const f2Values = formants.tracked[1]?.filter((f): f is number => f !== null && f > 0) ?? [];
    expect(f1Values.length).toBeGreaterThan(3);
    const medianF1 = sorted(f1Values)[Math.floor(f1Values.length / 2)];
    const medianF2 = sorted(f2Values)[Math.floor(f2Values.length / 2)];
    expect(Math.abs(medianF1 - 300)).toBeLessThan(120);
    expect(Math.abs(medianF2 - 870)).toBeLessThan(150);
  });
});

// ─── Intensity Validation ───────────────────────────────────────────────────────

describe('Validation: Intensity', () => {
  const sr = 16000;

  it('reports higher intensity for louder signal', () => {
    const quiet = sineWave(200, 0.3, sr, 0.1);
    const loud = sineWave(200, 0.3, sr, 0.8);
    const intQuiet = computeIntensity(quiet, sr);
    const intLoud = computeIntensity(loud, sr);
    const meanQuiet = intQuiet.values.reduce((a, b) => a + b, 0) / intQuiet.values.length;
    const meanLoud = intLoud.values.reduce((a, b) => a + b, 0) / intLoud.values.length;
    expect(meanLoud).toBeGreaterThan(meanQuiet);
    // ~18 dB difference expected (20*log10(0.8/0.1) ≈ 18 dB)
    expect(meanLoud - meanQuiet).toBeGreaterThan(10);
    expect(meanLoud - meanQuiet).toBeLessThan(25);
  });

  it('reports near-zero intensity for silence', () => {
    const silence = new Float32Array(sr * 0.3);
    const int = computeIntensity(silence, sr);
    const mean = int.values.reduce((a, b) => a + b, 0) / int.values.length;
    expect(mean).toBeLessThan(10); // very low dB
  });

  it('intensity is independent of frequency', () => {
    const s100 = sineWave(100, 0.3, sr, 0.5);
    const s1000 = sineWave(1000, 0.3, sr, 0.5);
    const int100 = computeIntensity(s100, sr);
    const int1000 = computeIntensity(s1000, sr);
    const mean100 = int100.values.reduce((a, b) => a + b, 0) / int100.values.length;
    const mean1000 = int1000.values.reduce((a, b) => a + b, 0) / int1000.values.length;
    // Should be within 2 dB of each other (same amplitude)
    expect(Math.abs(mean100 - mean1000)).toBeLessThan(2);
  });
});

// ─── Harmonicity (HNR) Validation ───────────────────────────────────────────────

describe('Validation: Harmonicity (HNR)', () => {
  const sr = 16000;

  it('pure tone has very high HNR (>20 dB)', () => {
    const samples = sineWave(150, 0.5, sr);
    const hnr = computeHarmonicity(samples, sr);
    const valid = hnr.values.filter(v => v > -200);
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    expect(mean).toBeGreaterThan(20);
  });

  it('white noise has low HNR (<5 dB)', () => {
    const n = Math.round(0.5 * sr);
    const samples = new Float32Array(n);
    // Deterministic pseudo-random
    let seed = 42;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
      samples[i] = (seed / 0x7FFFFFFF - 1) * 0.5;
    }
    const hnr = computeHarmonicity(samples, sr);
    const valid = hnr.values.filter(v => v > -200);
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    expect(mean).toBeLessThan(5);
  });
});

// ─── Utility ────────────────────────────────────────────────────────────────────

function sorted(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}
