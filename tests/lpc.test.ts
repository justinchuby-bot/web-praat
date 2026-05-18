import { describe, it, expect } from 'vitest';
import { burgMethod, extractFormants } from '../src/audio/lpc';

describe('Burg LPC method', () => {
  it('produces stable coefficients for a sine wave', () => {
    const sampleRate = 11025;
    const signal = new Float64Array(256);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate);
    }

    const coeffs = burgMethod(signal, 12);
    expect(coeffs.length).toBe(13);
    // First coefficient is unused (convention)
    expect(coeffs[0]).toBe(0);
    // Should have non-trivial coefficients
    const maxCoeff = Math.max(...Array.from(coeffs).map(Math.abs));
    expect(maxCoeff).toBeGreaterThan(0.1);
  });
});

describe('Formant extraction', () => {
  it('detects F1/F2 for a synthetic vowel /a/ (F1~700, F2~1200)', () => {
    // Synthesize a signal with known formant frequencies using additive synthesis
    const sampleRate = 44100;
    const frameSize = Math.round(sampleRate * 0.025);
    const f1Target = 700;
    const f2Target = 1200;

    // Create a signal that has energy around these formant frequencies
    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      const t = i / sampleRate;
      // Fundamental + harmonics shaped by formants
      let sample = 0;
      for (let h = 1; h <= 30; h++) {
        const f = h * 120; // F0 = 120 Hz
        // Simple formant filter shape
        const gain1 = 1 / (1 + Math.pow((f - f1Target) / 80, 2));
        const gain2 = 1 / (1 + Math.pow((f - f2Target) / 100, 2));
        sample += (gain1 + gain2) * Math.sin(2 * Math.PI * f * t);
      }
      frame[i] = sample;
    }

    const result = extractFormants(frame, sampleRate, 12);
    expect(result).not.toBeNull();
    if (result) {
      // Allow reasonable tolerance for LPC formant detection
      expect(result.f1).toBeGreaterThan(400);
      expect(result.f1).toBeLessThan(1000);
      expect(result.f2).toBeGreaterThan(900);
      expect(result.f2).toBeLessThan(1800);
    }
  });

  it('returns null for silence', () => {
    const frame = new Float64Array(1024); // all zeros
    const result = extractFormants(frame, 44100, 12);
    expect(result).toBeNull();
  });
});
