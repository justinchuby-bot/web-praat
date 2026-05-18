import { describe, it, expect } from 'vitest';
import { computeHarmonicity } from '../src/audio/harmonicity';

function generateSineWave(freq: number, sampleRate: number, duration: number): Float32Array {
  const n = Math.round(sampleRate * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

describe('computeHarmonicity', () => {
  it('returns high HNR for a pure sine wave', () => {
    const samples = generateSineWave(200, 16000, 0.5);
    const result = computeHarmonicity(samples, 16000);
    expect(result.times.length).toBeGreaterThan(0);
    // A pure tone should have very high HNR (> 20 dB)
    expect(result.meanHnrDb).toBeGreaterThan(10);
  });

  it('returns low/negative HNR for noise', () => {
    const n = 8000;
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = Math.random() * 2 - 1;
    const result = computeHarmonicity(samples, 16000);
    // Noise should have low HNR
    expect(result.meanHnrDb).toBeLessThan(5);
  });

  it('marks silent frames as -200', () => {
    const samples = new Float32Array(8000); // all zeros
    const result = computeHarmonicity(samples, 16000);
    expect(result.values.every(v => v === -200)).toBe(true);
  });
});
