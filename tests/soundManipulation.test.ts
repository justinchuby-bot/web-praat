import { describe, it, expect } from 'vitest';
import {
  extractPart,
  concatenate,
  reverse,
  fadeIn,
  fadeOut,
  scaleAmplitude,
  SoundBuffer,
} from '../src/audio/soundManipulation';

function makeBuf(length: number, sampleRate = 44100, fill?: (i: number) => number): SoundBuffer {
  const samples = new Float32Array(length);
  if (fill) {
    for (let i = 0; i < length; i++) samples[i] = fill(i);
  } else {
    for (let i = 0; i < length; i++) samples[i] = i / length;
  }
  return { samples, sampleRate };
}

describe('extractPart', () => {
  it('extracts a region without windowing', () => {
    const buf = makeBuf(44100); // 1 second
    const part = extractPart(buf, 0.25, 0.75);
    // Should be approximately 0.5s worth of samples
    expect(part.samples.length).toBeCloseTo(22050, -1);
    expect(part.sampleRate).toBe(44100);
  });

  it('applies hanning window', () => {
    const buf = makeBuf(1000, 1000, () => 1.0);
    const part = extractPart(buf, 0.1, 0.9, 'hanning');
    // First and last samples should be near zero
    expect(part.samples[0]).toBeCloseTo(0, 3);
    expect(part.samples[part.samples.length - 1]).toBeCloseTo(0, 3);
    // Middle should be near 1
    const mid = Math.floor(part.samples.length / 2);
    expect(part.samples[mid]).toBeCloseTo(1, 1);
  });

  it('throws on invalid range', () => {
    const buf = makeBuf(100, 100);
    expect(() => extractPart(buf, 0.5, 0.2)).toThrow();
  });

  it('clamps to buffer boundaries', () => {
    const buf = makeBuf(100, 100); // 1 second
    const part = extractPart(buf, -0.5, 1.5);
    expect(part.samples.length).toBe(100);
  });
});

describe('concatenate', () => {
  it('concatenates two buffers without overlap', () => {
    const a = makeBuf(100, 100, () => 0.5);
    const b = makeBuf(200, 100, () => -0.5);
    const result = concatenate([a, b]);
    expect(result.samples.length).toBe(300);
    expect(result.samples[50]).toBeCloseTo(0.5);
    expect(result.samples[200]).toBeCloseTo(-0.5);
    expect(result.sampleRate).toBe(100);
  });

  it('concatenates with crossfade overlap', () => {
    const a = makeBuf(100, 100, () => 1.0);
    const b = makeBuf(100, 100, () => -1.0);
    const result = concatenate([a, b], 0.2); // 20 samples overlap
    expect(result.samples.length).toBe(180);
  });

  it('throws on mismatched sample rates', () => {
    const a = makeBuf(100, 44100);
    const b = makeBuf(100, 22050);
    expect(() => concatenate([a, b])).toThrow(/sample rate/);
  });

  it('handles single buffer', () => {
    const a = makeBuf(50, 100);
    const result = concatenate([a]);
    expect(result.samples.length).toBe(50);
  });

  it('throws on empty input', () => {
    expect(() => concatenate([])).toThrow();
  });
});

describe('reverse', () => {
  it('reverses entire buffer', () => {
    const buf = makeBuf(5, 1, (i) => i + 1); // [1,2,3,4,5]
    const result = reverse(buf);
    expect(Array.from(result.samples)).toEqual([5, 4, 3, 2, 1]);
  });

  it('reverses a sub-region', () => {
    const buf = makeBuf(5, 1, (i) => i + 1); // [1,2,3,4,5]
    const result = reverse(buf, 1, 4); // reverse indices 1..3
    expect(Array.from(result.samples)).toEqual([1, 4, 3, 2, 5]);
  });
});

describe('fadeIn', () => {
  it('fades from 0 to full amplitude', () => {
    const buf = makeBuf(100, 100, () => 1.0);
    const result = fadeIn(buf, 0.5); // 50 samples fade
    expect(result.samples[0]).toBeCloseTo(0);
    expect(result.samples[25]).toBeCloseTo(0.5, 1);
    expect(result.samples[50]).toBeCloseTo(1.0);
    expect(result.samples[75]).toBeCloseTo(1.0);
  });
});

describe('fadeOut', () => {
  it('fades from full amplitude to 0', () => {
    const buf = makeBuf(100, 100, () => 1.0);
    const result = fadeOut(buf, 0.5); // 50 samples fade at end
    expect(result.samples[0]).toBeCloseTo(1.0);
    expect(result.samples[49]).toBeCloseTo(1.0);
    expect(result.samples[99]).toBeCloseTo(0, 1);
  });
});

describe('scaleAmplitude', () => {
  it('scales by factor', () => {
    const buf = makeBuf(10, 1, () => 0.5);
    const result = scaleAmplitude(buf, 2.0);
    expect(result.samples[0]).toBeCloseTo(1.0);
  });

  it('normalizes to peak 1.0 when no factor given', () => {
    const buf = makeBuf(10, 1, (i) => (i === 5 ? 0.25 : 0.1));
    const result = scaleAmplitude(buf);
    expect(result.samples[5]).toBeCloseTo(1.0);
  });

  it('handles silence gracefully', () => {
    const buf = makeBuf(10, 1, () => 0);
    const result = scaleAmplitude(buf);
    expect(result.samples[0]).toBe(0);
  });
});
