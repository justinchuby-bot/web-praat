import { describe, it, expect } from 'vitest';
import { analyzeAudio } from '../src/audio/analyzer';
import { defaultAnalysisSettings } from '../src/audio/defaults';

describe('Web Worker analysis (simulated)', () => {
  it('analyzeAudio returns all expected fields', () => {
    const sampleRate = 16000;
    const samples = new Float32Array(sampleRate * 0.5); // 0.5s silence
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 220 * i / sampleRate) * 0.5;
    }
    const result = analyzeAudio(samples, sampleRate, defaultAnalysisSettings);
    expect(result.waveform).toBeInstanceOf(Float32Array);
    expect(result.spectrogram.magnitudes.length).toBeGreaterThan(0);
    expect(result.pitch.times.length).toBeGreaterThan(0);
    expect(result.formants.times.length).toBeGreaterThan(0);
    expect(result.intensity.times.length).toBeGreaterThan(0);
    expect(result.duration).toBeCloseTo(0.5, 1);
  });

  it('result waveform buffer is transferable', () => {
    const sampleRate = 8000;
    const samples = new Float32Array(sampleRate * 0.5);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.1);
    const result = analyzeAudio(samples, sampleRate, defaultAnalysisSettings);
    // Verify the buffer can be structured-cloned (proxy for transferability)
    expect(result.waveform.buffer).toBeInstanceOf(ArrayBuffer);
    expect(result.spectrogram.magnitudes[0]?.buffer).toBeInstanceOf(ArrayBuffer);
  });
});
