import { describe, it, expect } from 'vitest';
import { initFft, isGpuFftActive, fftMagnitudeAuto, fftMagnitudeBatch } from '../src/utils/fft-adapter';
import { fftMagnitude } from '../src/utils/fft';

describe('fft-adapter', () => {
  it('initFft returns false in Node (no WebGPU)', async () => {
    const result = await initFft();
    expect(result).toBe(false);
  });

  it('isGpuFftActive returns false in Node', () => {
    expect(isGpuFftActive()).toBe(false);
  });

  it('fftMagnitudeAuto falls back to CPU and matches', async () => {
    const signal = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
      signal[i] = Math.sin(2 * Math.PI * 10 * i / 256);
    }
    const gpuResult = await fftMagnitudeAuto(signal, 256);
    const cpuResult = fftMagnitude(signal, 256);
    expect(gpuResult.length).toBe(cpuResult.length);
    for (let i = 0; i < gpuResult.length; i++) {
      expect(gpuResult[i]).toBeCloseTo(cpuResult[i], 10);
    }
  });

  it('fftMagnitudeBatch processes multiple frames', async () => {
    const frames = Array.from({ length: 4 }, (_, idx) => {
      const f = new Float64Array(128);
      for (let i = 0; i < 128; i++) f[i] = Math.sin(2 * Math.PI * (idx + 1) * 5 * i / 128);
      return f;
    });
    const results = await fftMagnitudeBatch(frames, 128);
    expect(results.length).toBe(4);
    for (const r of results) {
      expect(r.length).toBe(65); // 128/2 + 1
    }
  });
});

describe('computeSpectrogramGpu', () => {
  it('produces same result as sync version (CPU fallback)', async () => {
    const { computeSpectrogram, computeSpectrogramGpu } = await import('../src/audio/analyzer');
    const sampleRate = 16000;
    const samples = new Float32Array(8000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const syncResult = computeSpectrogram(samples, sampleRate);
    const asyncResult = await computeSpectrogramGpu(samples, sampleRate);

    expect(asyncResult.frameTimes.length).toBe(syncResult.frameTimes.length);
    expect(asyncResult.magnitudes.length).toBe(syncResult.magnitudes.length);
    expect(asyncResult.gpuAccelerated).toBe(false); // no GPU in Node

    // Spot-check a few values
    for (let i = 0; i < Math.min(5, asyncResult.magnitudes.length); i++) {
      for (let j = 0; j < asyncResult.magnitudes[i].length; j++) {
        expect(asyncResult.magnitudes[i][j]).toBeCloseTo(syncResult.magnitudes[i][j], 10);
      }
    }
  });
});
