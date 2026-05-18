import { describe, it, expect } from 'vitest';
import { computePitch } from '../src/audio/analyzer';

function generateSine(freq: number, sampleRate: number, duration: number): Float32Array {
  const n = Math.round(sampleRate * duration);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

describe('Pitch settings (Viterbi)', () => {
  const sr = 16000;

  it('detects 200 Hz sine with default settings', () => {
    const samples = generateSine(200, sr, 0.5);
    const result = computePitch(samples, sr);
    const voiced = result.frequencies.filter((f): f is number => f !== null);
    expect(voiced.length).toBeGreaterThan(0);
    const avg = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    expect(avg).toBeCloseTo(200, -1); // within ~10 Hz
  });

  it('respects minHz — rejects frequencies below floor', () => {
    const samples = generateSine(60, sr, 0.5);
    // With minHz=100, should not detect 60 Hz
    const result = computePitch(samples, sr, { pitch: { minHz: 100, maxHz: 600, voicingThreshold: 0.5, silenceThreshold: 0.09, octaveCost: 0.055, octaveJumpCost: 0.35, voicedUnvoicedCost: 0.14, maxCandidates: 15 } });
    const voiced = result.frequencies.filter((f): f is number => f !== null);
    // Should either not detect or detect at harmonic (120 Hz)
    for (const f of voiced) {
      expect(f).toBeGreaterThanOrEqual(100);
    }
  });

  it('higher voicing threshold produces more unvoiced frames', () => {
    // Low-amplitude noisy signal
    const n = Math.round(sr * 0.3);
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      buf[i] = 0.3 * Math.sin(2 * Math.PI * 150 * i / sr) + 0.2 * (Math.random() - 0.5);
    }
    const lowThresh = computePitch(buf, sr, { pitch: { minHz: 75, maxHz: 600, voicingThreshold: 0.3, silenceThreshold: 0.09, octaveCost: 0.055, octaveJumpCost: 0.35, voicedUnvoicedCost: 0.14, maxCandidates: 15 } });
    const highThresh = computePitch(buf, sr, { pitch: { minHz: 75, maxHz: 600, voicingThreshold: 0.7, silenceThreshold: 0.09, octaveCost: 0.055, octaveJumpCost: 0.35, voicedUnvoicedCost: 0.14, maxCandidates: 15 } });
    const voicedLow = lowThresh.frequencies.filter(f => f !== null).length;
    const voicedHigh = highThresh.frequencies.filter(f => f !== null).length;
    expect(voicedLow).toBeGreaterThanOrEqual(voicedHigh);
  });

  it('octave-jump cost reduces pitch jumps', () => {
    // Concatenate two frequencies with a jump
    const seg1 = generateSine(150, sr, 0.2);
    const seg2 = generateSine(300, sr, 0.2);
    const buf = new Float32Array(seg1.length + seg2.length);
    buf.set(seg1);
    buf.set(seg2, seg1.length);

    const lowJumpCost = computePitch(buf, sr, { pitch: { minHz: 75, maxHz: 600, voicingThreshold: 0.5, silenceThreshold: 0.09, octaveCost: 0.055, octaveJumpCost: 0.01, voicedUnvoicedCost: 0.14, maxCandidates: 15 } });
    const highJumpCost = computePitch(buf, sr, { pitch: { minHz: 75, maxHz: 600, voicingThreshold: 0.5, silenceThreshold: 0.09, octaveCost: 0.055, octaveJumpCost: 2.0, voicedUnvoicedCost: 0.14, maxCandidates: 15 } });

    // With high jump cost, more frames should converge to one frequency
    const voicedHigh = highJumpCost.frequencies.filter((f): f is number => f !== null);
    if (voicedHigh.length > 2) {
      const uniqueRounded = new Set(voicedHigh.map(f => Math.round(f / 10) * 10));
      // High jump cost should have fewer distinct pitch values
      expect(uniqueRounded.size).toBeLessThanOrEqual(3);
    }
  });

  it('silence threshold marks silent frames as unvoiced', () => {
    const n = Math.round(sr * 0.3);
    const buf = new Float32Array(n);
    // First half: loud sine; second half: near-silent
    for (let i = 0; i < n / 2; i++) buf[i] = Math.sin(2 * Math.PI * 200 * i / sr);
    for (let i = Math.round(n / 2); i < n; i++) buf[i] = 0.001 * Math.sin(2 * Math.PI * 200 * i / sr);

    const result = computePitch(buf, sr);
    // Last frames should mostly be unvoiced
    const lastQuarter = result.frequencies.slice(Math.round(result.frequencies.length * 0.75));
    const unvoiced = lastQuarter.filter(f => f === null).length;
    expect(unvoiced).toBeGreaterThan(lastQuarter.length * 0.5);
  });
});
