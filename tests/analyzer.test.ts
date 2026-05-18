import { describe, it, expect } from 'vitest';
import { computeSpectrogram, computePitch, computeIntensity } from '../src/audio/analyzer';
import { fftMagnitude } from '../src/utils/fft';

describe('FFT', () => {
  it('detects a known frequency sine wave', () => {
    const sampleRate = 44100;
    const freq = 440;
    const fftSize = 1024;
    const signal = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
    }

    const mag = fftMagnitude(signal, fftSize);
    // Find peak bin
    let maxVal = 0;
    let maxBin = 0;
    for (let i = 1; i < mag.length; i++) {
      if (mag[i] > maxVal) {
        maxVal = mag[i];
        maxBin = i;
      }
    }
    const detectedFreq = maxBin * sampleRate / fftSize;
    expect(Math.abs(detectedFreq - freq)).toBeLessThan(sampleRate / fftSize);
  });
});

describe('Pitch detection', () => {
  it('detects a single frequency tone', () => {
    const sampleRate = 16000;
    const f0 = 200;
    const duration = 0.5;
    const samples = new Float32Array(sampleRate * duration);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * f0 * i / sampleRate);
    }

    const pitch = computePitch(samples, sampleRate);
    // Most frames should detect ~200 Hz
    const voiced = pitch.frequencies.filter((f): f is number => f !== null);
    expect(voiced.length).toBeGreaterThan(pitch.frequencies.length * 0.5);

    const avgF0 = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(Math.abs(avgF0 - f0)).toBeLessThan(15);
  });
});

describe('Intensity', () => {
  it('computes correct RMS for known amplitude', () => {
    const sampleRate = 16000;
    const amplitude = 0.5;
    const samples = new Float32Array(sampleRate); // 1 second
    for (let i = 0; i < samples.length; i++) {
      samples[i] = amplitude * Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const intensity = computeIntensity(samples, sampleRate);
    // RMS of sine = amplitude / sqrt(2)
    const expectedRms = amplitude / Math.SQRT2;
    const expectedDb = 20 * Math.log10(expectedRms);

    // Check middle frames (avoid edge effects)
    const mid = Math.floor(intensity.values.length / 2);
    expect(Math.abs(intensity.values[mid] - expectedDb)).toBeLessThan(1);
  });
});

describe('Spectrogram', () => {
  it('produces correct number of frames and bins', () => {
    const sampleRate = 16000;
    const samples = new Float32Array(sampleRate); // 1 second
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
    }

    const spec = computeSpectrogram(samples, sampleRate);
    expect(spec.magnitudes.length).toBeGreaterThan(0);
    expect(spec.magnitudes[0].length).toBe(513); // 1024/2 + 1
    expect(spec.freqStep).toBeCloseTo(sampleRate / 1024);
  });
});
