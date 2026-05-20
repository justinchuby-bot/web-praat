import { describe, it, expect } from 'vitest';
import { analyzeAudio } from '../src/audio/analyzer';

describe('Query menu computations', () => {
  const sampleRate = 16000;
  const duration = 0.1;
  const numSamples = Math.floor(sampleRate * duration);
  // Generate a 440 Hz sine wave
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
  }

  const analysis = analyzeAudio(samples, sampleRate);

  it('spectral power at cursor is non-negative', () => {
    const sg = analysis.spectrogram;
    const frameIdx = Math.min(Math.round(0.05 / sg.timeStep), sg.magnitudes.length - 1);
    const frame = sg.magnitudes[frameIdx];
    let totalPower = 0;
    for (let i = 0; i < frame.length; i++) totalPower += frame[i] * frame[i];
    const powerDensity = totalPower * sg.freqStep;
    expect(powerDensity).toBeGreaterThan(0);
  });

  it('intensity at cursor returns valid dB', () => {
    const int = analysis.intensity;
    expect(int.times.length).toBeGreaterThan(0);
    // Find nearest to t=0.05
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < int.times.length; i++) {
      const d = Math.abs(int.times[i] - 0.05);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    expect(int.values[bestIdx]).toBeGreaterThan(0);
    expect(int.values[bestIdx]).toBeLessThan(120);
  });

  it('HNR at cursor returns finite value', () => {
    const hnr = analysis.harmonicity;
    expect(hnr.times.length).toBeGreaterThan(0);
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < hnr.times.length; i++) {
      const d = Math.abs(hnr.times[i] - 0.05);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    expect(Number.isFinite(hnr.values[bestIdx])).toBe(true);
  });

  it('voice quality jitter and shimmer are computed', () => {
    const vq = analysis.voiceQuality;
    expect(vq).toBeDefined();
    expect(vq.jitterLocalPercent).toBeGreaterThanOrEqual(0);
    expect(vq.shimmerLocalPercent).toBeGreaterThanOrEqual(0);
    expect(vq.shimmerDb).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(vq.jitterAbsolute)).toBe(true);
  });
});
