import { describe, expect, it } from 'vitest';
import { applyBiquadFilter } from '../src/audio/filters';
import { fftMagnitude } from '../src/utils/fft';

function sine(sampleRate: number, frequency: number, seconds = 1): Float32Array {
  const samples = new Float32Array(sampleRate * seconds);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function peakMagnitude(signal: Float32Array, sampleRate: number, frequency: number): number {
  const fftSize = 2048;
  const frame = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    frame[i] = signal[i];
  }
  const magnitudes = fftMagnitude(frame, fftSize);
  const bin = Math.round((frequency * fftSize) / sampleRate);
  return magnitudes[bin];
}

describe('biquad filters', () => {
  it('attenuates high frequencies with a low-pass filter', () => {
    const sampleRate = 16000;
    const signal = sine(sampleRate, 3000);
    const filtered = applyBiquadFilter(signal, sampleRate, { type: 'lowpass', cutoffHz: 1000, q: 0.707 });
    expect(peakMagnitude(filtered, sampleRate, 3000)).toBeLessThan(peakMagnitude(signal, sampleRate, 3000) * 0.4);
  });

  it('attenuates low frequencies with a high-pass filter', () => {
    const sampleRate = 16000;
    const signal = sine(sampleRate, 200);
    const filtered = applyBiquadFilter(signal, sampleRate, { type: 'highpass', cutoffHz: 1000, q: 0.707 });
    expect(peakMagnitude(filtered, sampleRate, 200)).toBeLessThan(peakMagnitude(signal, sampleRate, 200) * 0.4);
  });

  it('passes energy near the center of a band-pass filter', () => {
    const sampleRate = 16000;
    const signal = sine(sampleRate, 1000);
    const filtered = applyBiquadFilter(signal, sampleRate, { type: 'bandpass', cutoffHz: 1000, q: 2 });
    expect(peakMagnitude(filtered, sampleRate, 1000)).toBeGreaterThan(peakMagnitude(signal, sampleRate, 1000) * 0.4);
  });
});
