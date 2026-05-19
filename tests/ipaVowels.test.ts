import { describe, it, expect } from 'vitest';
import { classifyVowel, generateIpaAnnotations, vowelReferences } from '../src/audio/ipaVowels';

describe('IPA Vowel Classification', () => {
  it('classifies close front vowel [i]', () => {
    const result = classifyVowel(270, 2290);
    expect(result.symbol).toBe('i');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies open back vowel [ɑ]', () => {
    const result = classifyVowel(730, 1090);
    expect(result.symbol).toBe('ɑ');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies close back vowel [u]', () => {
    const result = classifyVowel(300, 870);
    expect(result.symbol).toBe('u');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies mid central vowel [ə]', () => {
    const result = classifyVowel(500, 1500);
    expect(result.symbol).toBe('ə');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies open-mid front vowel [ɛ]', () => {
    const result = classifyVowel(550, 1770);
    expect(result.symbol).toBe('ɛ');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns lower confidence for ambiguous values', () => {
    // Midway between two vowels
    const result = classifyVowel(450, 1400);
    expect(result.confidence).toBeLessThan(0.9);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('has all reference vowels with valid F1/F2', () => {
    for (const ref of vowelReferences) {
      expect(ref.f1).toBeGreaterThan(100);
      expect(ref.f1).toBeLessThan(1000);
      expect(ref.f2).toBeGreaterThan(500);
      expect(ref.f2).toBeLessThan(3000);
    }
  });
});

describe('generateIpaAnnotations', () => {
  it('generates annotations for voiced frames', () => {
    const times = [0.0, 0.1, 0.2, 0.3, 0.4];
    const f1: (number | null)[] = [270, null, 730, 500, 300];
    const f2: (number | null)[] = [2290, null, 1090, 1500, 870];

    const annotations = generateIpaAnnotations(times, f1, f2);
    expect(annotations.length).toBeGreaterThan(0);
    expect(annotations[0].symbol).toBe('i');
    expect(annotations[0].time).toBe(0.0);
  });

  it('skips null frames', () => {
    const times = [0.0, 0.1, 0.2];
    const f1: (number | null)[] = [null, null, null];
    const f2: (number | null)[] = [null, null, null];

    const annotations = generateIpaAnnotations(times, f1, f2);
    expect(annotations).toHaveLength(0);
  });

  it('respects minTimeGap', () => {
    const times = [0.0, 0.01, 0.02, 0.03, 0.1];
    const f1: (number | null)[] = [270, 270, 270, 270, 730];
    const f2: (number | null)[] = [2290, 2290, 2290, 2290, 1090];

    const annotations = generateIpaAnnotations(times, f1, f2, undefined, { minTimeGap: 0.05 });
    // Should only get 2: one at 0.0 and one at 0.1
    expect(annotations.length).toBe(2);
  });

  it('filters by intensity threshold', () => {
    const times = [0.0, 0.1, 0.2];
    const f1: (number | null)[] = [270, 730, 300];
    const f2: (number | null)[] = [2290, 1090, 870];
    const intensity = [-50, -30, -60]; // Only middle one above -40

    const annotations = generateIpaAnnotations(times, f1, f2, intensity, {
      minIntensityDb: -40,
      minTimeGap: 0,
    });
    expect(annotations.length).toBe(1);
    expect(annotations[0].time).toBe(0.1);
  });

  it('rejects implausible F1/F2 values', () => {
    const times = [0.0, 0.1];
    const f1: (number | null)[] = [50, 5000]; // Too low, too high
    const f2: (number | null)[] = [2000, 1000];

    const annotations = generateIpaAnnotations(times, f1, f2);
    expect(annotations).toHaveLength(0);
  });
});
